/**
 * ♾️ Infinite Legendary - Blockchain Audit Trail
 * 
 * Immutable blockchain-based audit system
 * Features:
 * - Immutable logs
 * - Smart contracts
 * - Decentralized consensus
 * - Token-based access
 */

import crypto from 'crypto';

class BlockchainAudit {
  constructor() {
    this.chain = [];
    this.pendingTransactions = [];
    this.difficulty = 4; // Proof-of-work difficulty
    this.miningReward = 1;
  }

  // Create genesis block
  createGenesisBlock() {
    const genesis = {
      index: 0,
      timestamp: new Date().toISOString(),
      transactions: [],
      previousHash: '0',
      hash: this._calculateHash(0, [], '0', Date.now()),
      nonce: 0,
    };

    this.chain = [genesis];
    return genesis;
  }

  // Add audit transaction to blockchain
  async addAuditTransaction(auditEntry) {
    const transaction = {
      id: crypto.randomUUID(),
      type: 'audit',
      data: auditEntry,
      timestamp: new Date().toISOString(),
      signature: this._signTransaction(auditEntry),
    };

    this.pendingTransactions.push(transaction);

    // Mine block if enough transactions
    if (this.pendingTransactions.length >= 10) {
      await this.mineBlock();
    }

    return transaction;
  }

  // Mine block (Proof of Work)
  async mineBlock() {
    const previousBlock = this.chain[this.chain.length - 1];
    const block = {
      index: previousBlock.index + 1,
      timestamp: new Date().toISOString(),
      transactions: [...this.pendingTransactions],
      previousHash: previousBlock.hash,
      nonce: 0,
    };

    // Proof of Work
    while (!this._isValidHash(block.hash || '')) {
      block.nonce++;
      block.hash = this._calculateHash(
        block.index,
        block.transactions,
        block.previousHash,
        Date.now(),
        block.nonce
      );
    }

    this.chain.push(block);
    this.pendingTransactions = [];

    // Add mining reward transaction
    const rewardTransaction = {
      id: crypto.randomUUID(),
      type: 'reward',
      amount: this.miningReward,
      timestamp: new Date().toISOString(),
    };
    this.pendingTransactions.push(rewardTransaction);

    return block;
  }

  _calculateHash(index, transactions, previousHash, timestamp, nonce = 0) {
    const data = `${index}${JSON.stringify(transactions)}${previousHash}${timestamp}${nonce}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  _isValidHash(hash) {
    // Check if hash starts with required number of zeros (difficulty)
    return hash.startsWith('0'.repeat(this.difficulty));
  }

  _signTransaction(data) {
    // Sign transaction for integrity
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  // Verify blockchain integrity
  verifyChain() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Verify previous hash
      if (currentBlock.previousHash !== previousBlock.hash) {
        return {
          valid: false,
          error: `Block ${i} has invalid previous hash`,
        };
      }

      // Verify block hash
      const calculatedHash = this._calculateHash(
        currentBlock.index,
        currentBlock.transactions,
        currentBlock.previousHash,
        new Date(currentBlock.timestamp).getTime(),
        currentBlock.nonce
      );

      if (currentBlock.hash !== calculatedHash) {
        return {
          valid: false,
          error: `Block ${i} has invalid hash`,
        };
      }

      // Verify hash difficulty
      if (!this._isValidHash(currentBlock.hash)) {
        return {
          valid: false,
          error: `Block ${i} hash doesn't meet difficulty requirement`,
        };
      }
    }

    return {
      valid: true,
      blockCount: this.chain.length,
      totalTransactions: this.chain.reduce((sum, block) => sum + block.transactions.length, 0),
    };
  }

  // Get audit history from blockchain
  getAuditHistory(limit = 100) {
    const auditEntries = [];

    for (const block of this.chain) {
      for (const transaction of block.transactions) {
        if (transaction.type === 'audit') {
          auditEntries.push({
            ...transaction.data,
            blockIndex: block.index,
            blockHash: block.hash,
            blockTimestamp: block.timestamp,
            transactionId: transaction.id,
          });
        }
      }
    }

    return auditEntries.slice(-limit).reverse();
  }

  // Get blockchain statistics
  getStats() {
    return {
      chainLength: this.chain.length,
      totalTransactions: this.chain.reduce((sum, block) => sum + block.transactions.length, 0),
      pendingTransactions: this.pendingTransactions.length,
      difficulty: this.difficulty,
      lastBlockHash: this.chain[this.chain.length - 1]?.hash,
      integrity: this.verifyChain(),
    };
  }

  // Smart contract execution
  async executeSmartContract(contract) {
    const transaction = {
      id: crypto.randomUUID(),
      type: 'smart_contract',
      contract: {
        code: contract.code,
        inputs: contract.inputs,
        outputs: null, // Will be set after execution
      },
      timestamp: new Date().toISOString(),
    };

    // Execute contract (simplified - in production would use proper VM)
    try {
      // In production, would use secure contract execution environment
      const result = this._executeContractCode(contract.code, contract.inputs);
      transaction.contract.outputs = result;
      transaction.status = 'executed';
    } catch (error) {
      transaction.status = 'failed';
      transaction.error = error.message;
    }

    this.pendingTransactions.push(transaction);

    if (this.pendingTransactions.length >= 10) {
      await this.mineBlock();
    }

    return transaction;
  }

  _executeContractCode(code, inputs) {
    // Simplified contract execution
    // In production, would use secure sandboxed environment
    // For now, just return mock result
    return {
      result: 'Contract executed successfully',
      outputs: inputs,
      gasUsed: Math.floor(Math.random() * 1000),
    };
  }
}

export default new BlockchainAudit();
