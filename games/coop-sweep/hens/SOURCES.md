# Hen art: sources and licensing

**Status: NO LICENSE FOUND. Do not ship publicly until the hens.farm team gives permission, or swap these files out.**

## Where these images came from

The Hens NFT collection on Robinhood Chain (chain id 4663), from <https://hens.farm>.

- Contract: `HenNFT` at `0x00466c0053fa70c309e778b49293f5a1c3da1cde` (name "Hens", symbol "HEN"). It's an upgradeable proxy, per HoodScan.
- `tokenURI(id)` returns `ipfs://bafybeieqtouthwt6upniqt23utcpxl56ayiywxy5gwl7tuhrjnq63vavie/<id>`, and the JSON is served at `<id>.json` in that folder. Each metadata `image` points to `ipfs://bafybeibv7nzi6evgdm54ga5zidm3duss3didvt26h3gkniopeutyslzeoa/<id>.jpg` (1254×1254 JPEG with a flat background).
- All six token ids below were checked as minted (`ownerOf` succeeded) on 2026-10-07 HST, through `https://rpc.mainnet.chain.robinhood.com`.
- Fetched through the `gateway.pinata.cloud` IPFS gateway on 2026-10-07 HST.
- The site also serves the same art as AVIF at `https://hens.farm/api/hen-image/<id>?v=collection-v2`. That wasn't used here.

| File | Token | Original image | Metadata | Traits | sha256 of original JPEG |
|---|---|---|---|---|---|
| `hen-8.png` | Hen #8 | `ipfs://bafybeibv7nzi6evgdm54ga5zidm3duss3didvt26h3gkniopeutyslzeoa/8.jpg` | `ipfs://bafybeieqtouthwt6upniqt23utcpxl56ayiywxy5gwl7tuhrjnq63vavie/8.json` | background: Liquidity Pool, body: Red Candle, feet: Green Means Go, neck: Hen Choker, torso: Risk On Resort | `c5017454ce96a4ce…` |
| `hen-9.png` | Hen #9 | `ipfs://bafybeibv7nzi6evgdm54ga5zidm3duss3didvt26h3gkniopeutyslzeoa/9.jpg` | `ipfs://bafybeieqtouthwt6upniqt23utcpxl56ayiywxy5gwl7tuhrjnq63vavie/9.json` | background: Plum Position, body: Hood Green, feet: Blue Chip Steps, head: Stagecoach, tail: Market Kraken | `9e277f3a22f048b0…` |
| `hen-12.png` | Hen #12 | `ipfs://bafybeibv7nzi6evgdm54ga5zidm3duss3didvt26h3gkniopeutyslzeoa/12.jpg` | `ipfs://bafybeieqtouthwt6upniqt23utcpxl56ayiywxy5gwl7tuhrjnq63vavie/12.json` | background: Sunlit Chain, body: Free Range, head: Power Hour, tail: Striped Assets, torso: Loxley Feather | `2b71a84440ebbb6d…` |
| `hen-13.png` | Hen #13 | `ipfs://bafybeibv7nzi6evgdm54ga5zidm3duss3didvt26h3gkniopeutyslzeoa/13.jpg` | `ipfs://bafybeieqtouthwt6upniqt23utcpxl56ayiywxy5gwl7tuhrjnq63vavie/13.json` | background: Orange Squeeze, body: Hood Green, feet: Grape Stomp, head: Moonboy, neck: Gld Bar, tail: Liquid Exit | `0810ea95db725f99…` |
| `hen-20.png` | Hen #20 | `ipfs://bafybeibv7nzi6evgdm54ga5zidm3duss3didvt26h3gkniopeutyslzeoa/20.jpg` | `ipfs://bafybeieqtouthwt6upniqt23utcpxl56ayiywxy5gwl7tuhrjnq63vavie/20.json` | background: Harvest Yield, body: Free Range, head: Backroom Deal, tail: Peacock Portfolio, torso: Royale With Cheese | `cd13307dcee2eeca…` |
| `hen-1.png` | Hen #1 | `ipfs://bafybeibv7nzi6evgdm54ga5zidm3duss3didvt26h3gkniopeutyslzeoa/1.jpg` | `ipfs://bafybeieqtouthwt6upniqt23utcpxl56ayiywxy5gwl7tuhrjnq63vavie/1.json` | background: Red Ledger, body: Grape Ape, feet: Orange You Glad, head: Moonboy, neck: Gold Duck | `141605a6b0306be7…` |

### What was changed

- The flat background was removed by flood fill from the edges, then the image was cropped and scaled to 256 px tall PNG.
- The game adds the white paper-cutout outline and the drop shadow at runtime. The hen artwork itself is unchanged.
- Nothing is loaded from hens.farm or IPFS at runtime. These files are bundled.

## What the license / terms say

Nothing found, as of 2026-10-07 HST:

- **hens.farm site**: no terms, license or IP page. `/terms` and `/license` are 404. The home, mint, marketplace, docs, docs-simple and docs-technical pages contain no license or usage language.
- **Footer**: only "hens.farm © 2026".
- **Token metadata**: has no `license` field. The description is just "One of 10,000 Hens."
- **Contract**: the Hen NFT has no `contractURI` (the call reverts), so there's no collection-level license there.
- **GitHub**: the only public repo found (`zvg26dphvw-sys/hens-v4-hook`, linked from HoodScan) is MIT. That license covers the Uniswap hook *code* only, not the hen art.
- **History**: the site calls the collection "a familiar spirit" of the earlier Chikn collection, so the art may also involve Chikn's rights. That wasn't researched further.

No license means default copyright applies: all rights reserved by the creator. Holding a Hen NFT doesn't grant art rights unless the project says so, and it doesn't.

## Before going live

1. Ask the hens.farm team (x.com/hensdotfarm) for written permission to use the Hen art in a free browser game. Credit them in the game and the post.
2. If permission isn't given, replace the PNGs here with original art and update `manifest.js`. The game also runs with no hen files at all, using its own drawn hens.
