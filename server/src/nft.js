// NFT gate reader: balanceOf(wallet) on the gate contract, with a short cache.
// Entry checks may use the cache; prize claims must pass { fresh: true }.
import { createPublicClient, http, parseAbi, getAddress } from 'viem';

const ABI = parseAbi(['function balanceOf(address owner) view returns (uint256)']);

export function createGate(gateCfg, { readBalance, now = () => Date.now() } = {}) {
  const cache = new Map();
  let reader = readBalance;
  if (!reader && gateCfg.configured) {
    const client = createPublicClient({ transport: http(gateCfg.rpcUrl, { timeout: 8000 }) });
    const contract = getAddress(gateCfg.contract);
    reader = async address => client.readContract({ address: contract, abi: ABI, functionName: 'balanceOf', args: [address] });
  }
  const configured = Boolean(gateCfg.configured && reader);

  return {
    configured,
    // -> 'holder' | 'not-holder' | 'unconfigured' | 'error'
    async check(address, { fresh = false } = {}) {
      if (!configured) return 'unconfigured';
      const key = address.toLowerCase();
      const hit = cache.get(key);
      if (!fresh && hit && now() - hit.at < gateCfg.cacheSeconds * 1000) return hit.status;
      try {
        const bal = BigInt(await reader(address));
        const status = bal >= gateCfg.minBalance ? 'holder' : 'not-holder';
        cache.set(key, { status, at: now() });
        return status;
      } catch {
        return 'error';
      }
    },
    forget(address) { cache.delete(address.toLowerCase()); },
  };
}
