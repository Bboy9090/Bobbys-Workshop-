"""
Trapdoor API Server - REST API wrapper for trapdoor module
Exposes tool management and execution via HTTP endpoints
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import sys
import threading
import subprocess
from typing import Dict, Any, Optional
from .trapdoor import TOOLS, verify_tool_hash, _check_binary, run_tool, calculate_sha256
from .core import log

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'module': 'trapdoor_api',
        'tools_configured': len(TOOLS)
    })

@app.route('/api/tools/list', methods=['GET'])
def list_tools():
    """List all available tools with their status"""
    tools_list = []
    
    for tool_key, tool_config in TOOLS.items():
        exists = _check_binary(tool_key)
        has_hash = tool_config.get("sha256") is not None
        
        # Calculate current hash if file exists
        current_hash = None
        if exists and os.path.exists(tool_config["path"]):
            current_hash = calculate_sha256(tool_config["path"])
        
        # Verify hash if both exist
        hash_valid = None
        if has_hash and current_hash:
            hash_valid = (current_hash.lower() == tool_config["sha256"].lower())
        
        tools_list.append({
            'key': tool_key,
            'name': tool_config.get('desc', tool_key),
            'path': tool_config['path'],
            'type': tool_config.get('type', 'bin'),
            'exists': exists,
            'has_hash_configured': has_hash,
            'expected_hash': tool_config.get('sha256'),
            'current_hash': current_hash,
            'hash_valid': hash_valid,
            'status': _get_tool_status(exists, has_hash, hash_valid)
        })
    
    return jsonify({
        'success': True,
        'tools': tools_list,
        'count': len(tools_list)
    })

@app.route('/api/tools/<tool_key>/verify', methods=['POST'])
def verify_tool(tool_key: str):
    """Verify a specific tool's hash"""
    if tool_key not in TOOLS:
        return jsonify({
            'success': False,
            'error': f'Unknown tool: {tool_key}'
        }), 404
    
    tool_config = TOOLS[tool_key]
    
    # Check if file exists
    if not _check_binary(tool_key):
        return jsonify({
            'success': False,
            'error': 'Tool file not found',
            'path': tool_config['path']
        }), 404
    
    # Verify hash
    is_valid, error_msg = verify_tool_hash(tool_key)
    
    # Calculate current hash
    current_hash = None
    if os.path.exists(tool_config["path"]):
        current_hash = calculate_sha256(tool_config["path"])
    
    return jsonify({
        'success': is_valid,
        'tool': tool_key,
        'path': tool_config['path'],
        'hash_valid': is_valid,
        'expected_hash': tool_config.get('sha256'),
        'current_hash': current_hash,
        'error': error_msg if not is_valid else None
    })

def execute_tool_with_output(tool_key: str, args: list, session_id: str):
    """Execute tool and stream output via WebSocket"""
    tool_config = TOOLS[tool_key]
    cmd = [tool_config['path']] + args
    
    try:
        socketio.emit('tool_output', {
            'session_id': session_id,
            'type': 'start',
            'message': f'Starting execution: {" ".join(cmd)}'
        }, room=session_id)
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Stream output line by line
        for line in iter(process.stdout.readline, ''):
            if line:
                socketio.emit('tool_output', {
                    'session_id': session_id,
                    'type': 'stdout',
                    'message': line.rstrip()
                }, room=session_id)
        
        process.wait()
        
        socketio.emit('tool_output', {
            'session_id': session_id,
            'type': 'end',
            'exit_code': process.returncode,
            'message': f'Execution completed with exit code {process.returncode}'
        }, room=session_id)
        
    except Exception as e:
        socketio.emit('tool_output', {
            'session_id': session_id,
            'type': 'error',
            'message': f'Execution error: {str(e)}'
        }, room=session_id)

@app.route('/api/tools/<tool_key>/execute', methods=['POST'])
def execute_tool(tool_key: str):
    """Execute a tool with optional arguments"""
    if tool_key not in TOOLS:
        return jsonify({
            'success': False,
            'error': f'Unknown tool: {tool_key}'
        }), 404
    
    data = request.get_json() or {}
    args = data.get('args', [])
    skip_verification = data.get('skip_verification', False)
    use_websocket = data.get('use_websocket', False)
    session_id = data.get('session_id')
    
    tool_config = TOOLS[tool_key]
    
    # Check if file exists
    if not _check_binary(tool_key):
        return jsonify({
            'success': False,
            'error': 'Tool file not found',
            'path': tool_config['path']
        }), 404
    
    # Verify hash unless skipped
    if not skip_verification:
        is_valid, error_msg = verify_tool_hash(tool_key)
        if not is_valid:
            return jsonify({
                'success': False,
                'error': 'Hash verification failed',
                'details': error_msg,
                'tool': tool_key
            }), 403
    
    # Execute tool with WebSocket streaming if requested
    if use_websocket and session_id:
        try:
            # Start execution in background thread
            thread = threading.Thread(
                target=execute_tool_with_output,
                args=(tool_key, args, session_id)
            )
            thread.daemon = True
            thread.start()
            
            return jsonify({
                'success': True,
                'message': 'Tool execution started',
                'tool': tool_key,
                'session_id': session_id,
                'note': 'Output will be streamed via WebSocket'
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e),
                'tool': tool_key
            }), 500
    else:
        # Synchronous execution (legacy)
        try:
            return jsonify({
                'success': True,
                'message': 'Tool execution requested',
                'tool': tool_key,
                'path': tool_config['path'],
                'args': args,
                'note': 'For real-time output, use WebSocket mode'
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e),
                'tool': tool_key
            }), 500

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    emit('connected', {'message': 'Connected to trapdoor API'})

@socketio.on('join_session')
def handle_join_session(data):
    """Join a tool execution session"""
    session_id = data.get('session_id')
    if session_id:
        from flask_socketio import join_room
        join_room(session_id)
        emit('joined', {'session_id': session_id, 'message': 'Joined execution session'})

@app.route('/api/tools/<tool_key>/hash', methods=['POST'])
def update_tool_hash(tool_key: str):
    """Update or set the hash for a tool"""
    if tool_key not in TOOLS:
        return jsonify({
            'success': False,
            'error': f'Unknown tool: {tool_key}'
        }), 404
    
    data = request.get_json() or {}
    new_hash = data.get('hash', '').strip()
    
    if not new_hash:
        return jsonify({
            'success': False,
            'error': 'Hash is required'
        }), 400
    
    # Validate hash format (64 hex characters)
    if len(new_hash) != 64 or not all(c in '0123456789abcdefABCDEF' for c in new_hash):
        return jsonify({
            'success': False,
            'error': 'Invalid hash format. Must be 64 hex characters (SHA256)'
        }), 400
    
    # Update the hash in memory (note: this doesn't persist to file)
    TOOLS[tool_key]['sha256'] = new_hash.lower()
    
    # Verify against current file if it exists
    hash_valid = None
    current_hash = None
    if _check_binary(tool_key) and os.path.exists(TOOLS[tool_key]["path"]):
        current_hash = calculate_sha256(TOOLS[tool_key]["path"])
        hash_valid = (current_hash.lower() == new_hash.lower())
    
    return jsonify({
        'success': True,
        'message': 'Hash updated',
        'tool': tool_key,
        'hash': new_hash.lower(),
        'current_file_hash': current_hash,
        'matches': hash_valid
    })

@app.route('/api/tools/<tool_key>/info', methods=['GET'])
def get_tool_info(tool_key: str):
    """Get detailed information about a tool"""
    if tool_key not in TOOLS:
        return jsonify({
            'success': False,
            'error': f'Unknown tool: {tool_key}'
        }), 404
    
    tool_config = TOOLS[tool_key]
    exists = _check_binary(tool_key)
    has_hash = tool_config.get("sha256") is not None
    
    current_hash = None
    hash_valid = None
    if exists and os.path.exists(tool_config["path"]):
        current_hash = calculate_sha256(tool_config["path"])
        if has_hash:
            hash_valid = (current_hash.lower() == tool_config["sha256"].lower())
    
    return jsonify({
        'success': True,
        'tool': {
            'key': tool_key,
            'name': tool_config.get('desc', tool_key),
            'path': tool_config['path'],
            'type': tool_config.get('type', 'bin'),
            'args': tool_config.get('args', []),
            'exists': exists,
            'has_hash_configured': has_hash,
            'expected_hash': tool_config.get('sha256'),
            'current_hash': current_hash,
            'hash_valid': hash_valid,
            'status': _get_tool_status(exists, has_hash, hash_valid)
        }
    })

def _get_tool_status(exists: bool, has_hash: bool, hash_valid: Optional[bool]) -> str:
    """Get human-readable status string"""
    if not exists:
        return 'not_found'
    if not has_hash:
        return 'unverified'
    if hash_valid is None:
        return 'unknown'
    if hash_valid:
        return 'verified'
    return 'hash_mismatch'

if __name__ == '__main__':
    port = int(os.environ.get('TRAPDOOR_API_PORT', 5001))
    socketio.run(app, host='0.0.0.0', port=port, debug=True, allow_unsafe_werkzeug=True)
