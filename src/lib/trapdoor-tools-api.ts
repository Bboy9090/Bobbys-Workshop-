/**
 * Trapdoor Tools API Client
 * 
 * TypeScript client for interacting with trapdoor tools API
 */

export interface Tool {
  key: string;
  name: string;
  path: string;
  type: 'bin' | 'exploit' | 'source_check' | 'win_exe' | 'file';
  exists: boolean;
  has_hash_configured: boolean;
  expected_hash?: string;
  current_hash?: string;
  hash_valid?: boolean;
  status: 'not_found' | 'unverified' | 'unknown' | 'verified' | 'hash_mismatch';
}

export interface ToolInfo extends Tool {
  args: string[];
}

export interface ToolVerifyResult {
  success: boolean;
  tool: string;
  path: string;
  hash_valid: boolean;
  expected_hash?: string;
  current_hash?: string;
  error?: string;
}

export interface ToolExecuteResult {
  success: boolean;
  tool: string;
  message?: string;
  note?: string;
  error?: string;
}

export interface ToolHashUpdateResult {
  success: boolean;
  tool: string;
  hash: string;
  matches: boolean;
  current_file_hash?: string;
}

/**
 * List all available tools
 */
export async function listTools(passcode?: string): Promise<Tool[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (passcode) {
    headers['X-Secret-Room-Passcode'] = passcode;
  }

  const response = await fetch('/api/v1/trapdoor/tools', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to list tools: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data?.tools || [];
}

/**
 * Get detailed information about a tool
 */
export async function getToolInfo(toolKey: string, passcode?: string): Promise<ToolInfo> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (passcode) {
    headers['X-Secret-Room-Passcode'] = passcode;
  }

  const response = await fetch(`/api/v1/trapdoor/tools/${toolKey}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to get tool info: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || {};
}

/**
 * Verify a tool's hash
 */
export async function verifyTool(
  toolKey: string,
  passcode?: string
): Promise<ToolVerifyResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (passcode) {
    headers['X-Secret-Room-Passcode'] = passcode;
  }

  const response = await fetch(`/api/v1/trapdoor/tools/${toolKey}/verify`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Failed to verify tool: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || {};
}

/**
 * Execute a tool
 */
export async function executeTool(
  toolKey: string,
  options: {
    args?: string[];
    deviceSerial?: string;
    skip_verification?: boolean;
    confirmation?: string;
  },
  passcode?: string
): Promise<ToolExecuteResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (passcode) {
    headers['X-Secret-Room-Passcode'] = passcode;
  }

  const response = await fetch(`/api/v1/trapdoor/tools/${toolKey}/execute`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      args: options.args || [],
      deviceSerial: options.deviceSerial,
      skip_verification: options.skip_verification || false,
      confirmation: options.confirmation || 'EXECUTE',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Failed to execute tool: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || {};
}

/**
 * Update a tool's hash
 */
export async function updateToolHash(
  toolKey: string,
  hash: string,
  passcode?: string
): Promise<ToolHashUpdateResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (passcode) {
    headers['X-Secret-Room-Passcode'] = passcode;
  }

  const response = await fetch(`/api/v1/trapdoor/tools/${toolKey}/hash`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      hash,
      confirmation: 'UPDATE_HASH',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Failed to update tool hash: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || {};
}
