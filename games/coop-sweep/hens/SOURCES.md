# Bird art: sources and permission

This folder holds two sets of art, and `manifest.js` lists both in one pool:

- **6 Hens** from hens.farm (`hen-*.png`)
- **8 Chikn PFPs** (`chikn-*.png`, `pfp-featherw8money.png`), from Chikn on chikn.farm

Each board hides 10 birds drawn at random from all 14.

**Permission status, 2026-10-07 HST:** Sev7, the repo owner, states that both the hens.farm team and the Chikn collection gave permission to use this art in Coop Sweep. That permission isn't recorded in this repo. Add a link to the written permission here when you have one. If either permission is withdrawn, delete that set's files and its entries in `manifest.js`. The game keeps working with whatever is left. With no files at all, it draws its own paper hens.

# Part 1: Hens (hens.farm)

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

## Permission

The research above found no public license. Sev7 states that the hens.farm team has since given permission, and Coop Sweep went live with this art on that basis. Credit hens.farm in posts about the game.

# Part 2: Chikn PFPs (Chikn, chikn.farm)

These are from Chikn, a 9,471-token Avalanche collection, picked from accounts posting about $HEGG / @hensdotfarm. Sev7 states that Chikn gave permission to use this art (see the status at the top). The individual X account holders weren't contacted.

- In the game they're bundled files like the hens, and nothing is fetched from chikn.farm or X at runtime.
- `manifest.js` records each image's set and credit (the X handle).
- All PNGs are 256 px tall, transparent and facing right. The game adds the paper outline and shadow, and doesn't recolour or rescale them beyond fitting the tile.

## How the accounts were found

- I searched public X posts from 2026-09-24 to 2026-10-07 HST for `$HEGG`, `hegg` and `@hensdotfarm`, using the X API (app-only, no login), and read the mentions of @hensdotfarm. About 70 accounts came up, and I checked each one's avatar by eye.
- I kept the accounts whose avatar is clearly photo-real Chikn art. Chikn is the Avalanche collection, contract served by `api.chikn.farm`.
- I matched each avatar to a token by pulling the trait data for all 9,471 Chikn from `https://forage-public-api.chikn.farm/api/chikns`, filtering by the traits I could see, then comparing the avatar pixel by pixel with each candidate's official image (RMSE at 48x48).
- The official images come from `https://api.chikn.farm/api/chikn/metadata/<id>` → `image`, which is a 1000x1000 JPEG on the chikn-farm DigitalOcean CDN. They were fetched on 2026-10-07 HST.

## What was changed

- Each source was scaled to 640 px. Chikn #783 also had its 7.5% "space trim" frame cropped off. The background and cast shadow were then removed with `rembg` and the BiRefNet-general model (alpha below 24 dropped). The result was cropped to the subject and scaled to 256 px tall as an RGBA PNG.
- This isn't the flood-fill method used for the hens. Chikn art has soft cast shadows and gradient or frame trims that flood fill leaves behind. Script: `process.py` (kept with the prep files outside the repo, in `/workspace/chikn-pfps/` on the build box).
- All the birds face right, like the hens. The game adds the paper outline and shadow at runtime, so none is baked in here.
- The untouched official JPEGs (`originals/`) and X avatars (`avatars/`, 400x400) stay with the prep files and are not bundled. Their sha256 is in the table.

## Files

| File | X account | Post about $HEGG | Image source | Chikn token | Match | sha256 (PNG) | sha256 (source) |
|---|---|---|---|---|---|---|---|
| `chikn-7897.png` | [@Chodi_avax](https://x.com/Chodi_avax) | [2026-10-07 10:10 HST](https://x.com/Chodi_avax/status/2107926667247390728) | https://chikn-farm.sfo3.cdn.digitaloceanspaces.com/chikn/image/2a559af35ad256b590937f0562d51afbf9a95075.jpeg | [#7897](https://api.chikn.farm/api/chikn/metadata/7897) | exact (avatar = official image, RMSE 0.8) | `5f1105a0b6a8e66618a61b9b2b2f6c62386f304f32c929d956d8ce4b29591246` | `0d43915dfabda4666684c60e800b84fc4cf21be19b742b7ad6399d8f9be0908e` |
| `chikn-2252.png` | [@CryptoQuine](https://x.com/CryptoQuine) | [2026-10-06 09:51 HST](https://x.com/CryptoQuine/status/2107559488798564814) | https://chikn-farm.sfo3.cdn.digitaloceanspaces.com/chikn/image/e3c4f5c823634cf038ba332de20f1cefad515e27.jpeg | [#2252](https://api.chikn.farm/api/chikn/metadata/2252) | exact (RMSE 1.0) | `9e8c03ced207f65a90b32e0970b4f56c8a811a982b245e6076f1b486869f1023` | `887c035bccc8a8ec75a00f7c3477071157c6a5f5a2bf097618097f21b8efd4c7` |
| `chikn-5644.png` | [@grenvilleriley](https://x.com/grenvilleriley) | [2026-10-03 06:58 HST](https://x.com/grenvilleriley/status/2106428674472042570) | https://chikn-farm.sfo3.cdn.digitaloceanspaces.com/chikn/image/c5c7dad2f44802f19a8110eef3fda8a79c572a7e.jpeg | [#5644](https://api.chikn.farm/api/chikn/metadata/5644) | exact (RMSE 0.9) | `697b71ae816d306376f4892a597ff27bd96430568d3acff79a1087f53ee8c9e0` | `ed0b86dbf9e24a918edb5d9df4e3baf63ac231c04ad5282b15360ba854e4cbfa` |
| `chikn-465.png` | [@struccc](https://x.com/struccc) | [2026-10-05 12:11 HST](https://x.com/struccc/status/2107232175149961227) ('bok bok' reply to @hensdotfarm's post announcing HEGG burns/GLD pools; struccc's own posts don't contain the word HEGG) | https://chikn-farm.sfo3.cdn.digitaloceanspaces.com/chikn/image/2f7e829447f4371d2913530351ec1879cfde5c0e.jpeg | [#465](https://api.chikn.farm/api/chikn/metadata/465) | exact (RMSE 1.3) | `07f5f6d7a4357c60ccfd12e3ac144bf54b6fdcdb30a5b8e76978392851076021` | `01537508417528657b019f9f03e00e14a393ae88e811716ca128819704587a98` |
| `chikn-783.png` | [@0xAinur](https://x.com/0xAinur) | [2026-10-07 08:16 HST](https://x.com/0xAinur/status/2107897817788482003) | https://chikn-farm.sfo3.cdn.digitaloceanspaces.com/chikn/image/e934fbd4a0f49e006c05f017d8767a442a69fa02.jpeg | [#783](https://api.chikn.farm/api/chikn/metadata/783) | visual (avatar is a zoomed crop of the official image without the space-trim frame); traits nightstalker blue / sucker / avax bling / mighty broadsword / liarliar / red vans | `0fc35044afc029f989b16f10819af3af9b8f59aa5aa5e7d6661c509c7a28024d` | `59e9908ddfff8bd0d38bfc53023f46996cb9813338af4b89e1c242c896c856ab` |
| `chikn-5418.png` | [@CryptoApe16](https://x.com/CryptoApe16) | [2026-10-07 08:58 HST](https://x.com/CryptoApe16/status/2107908353028460705) | https://chikn-farm.sfo3.cdn.digitaloceanspaces.com/chikn/image/ba384786616c5940a46861cae5ada099d29028a2.jpeg | [#5418](https://api.chikn.farm/api/chikn/metadata/5418) | visual (same pose, plum bg, red bowtie, bag of cash, green feet; RMSE 14.6, slight crop/recompression) | `79cbaa2245d0bfe83a84595a17123c1824fd43c2e1070f44dec1863ce463731c` | `25feea714ebc706aa3f19337106503a41a00b97caa322571964ca12067ac67fa` |
| `chikn-2144.png` | [@steeeevO_crypto](https://x.com/steeeevO_crypto) | [2026-10-06 20:23 HST](https://x.com/steeeevO_crypto/status/2107718379742351509) | https://chikn-farm.sfo3.cdn.digitaloceanspaces.com/chikn/image/7262fbf95cab35c676d0c516e9b2771e506ea3cc.jpeg | [#2144](https://api.chikn.farm/api/chikn/metadata/2144) | probable base only: the avatar is an edited/AI-redrawn bodybuilder version. Traits match #2144 exactly (rustic brown, red bandana, very fresh egg, real feet, cornhusk) but the pose differs | `190772d6b2041a33e9a0a22bece9d56c87a4a42a4f19e9ade75f60df5cda7197` | `d534ec4acbd153de0901e51d29f3f02cd5dc2948bc6b8c7019b697e8b2b37934` |
| `pfp-featherw8money.png` | [@featherw8money](https://x.com/featherw8money) | [2026-10-06 17:16 HST](https://x.com/featherw8money/status/2107671291020943454) | https://pbs.twimg.com/profile_images/2104578989008228352/Kmq_pToI_400x400.jpg | unknown | none: custom edit of a mutant-purple Chikn (gold DEGEN chain, briefcases, sunglasses, chart background) - no token has this trait set; closest bases #7463/#5676 (avax degen) but not a match | `30a113cbc12c7dbb8a4b596c9ea13158a169f47d46e52ae96d11e660673bdf5b` | `76966ee3573946b0bb19d8993c6ee433f799c46674141c0b3cfe8152a6140877` |

The X avatar URL for each account, at 400x400, is below. It's kept for reference even when the official art was used:

- @Chodi_avax: https://pbs.twimg.com/profile_images/1760047962699309057/l7LAWy5j_400x400.jpg
- @CryptoQuine: https://pbs.twimg.com/profile_images/1981597052996825088/Cz3hNR6d_400x400.jpg
- @grenvilleriley: https://pbs.twimg.com/profile_images/1759978751977570304/ZwGQpFWk_400x400.jpg
- @struccc: https://pbs.twimg.com/profile_images/1458563194771984389/VZh-dCwq_400x400.jpg
- @0xAinur: https://pbs.twimg.com/profile_images/1886325724128124928/8ORJKCu9_400x400.jpg
- @CryptoApe16: https://pbs.twimg.com/profile_images/2107899654780145664/SlwXkXMA_400x400.jpg
- @steeeevO_crypto: https://pbs.twimg.com/profile_images/2067361228364926976/qp1WP7iQ_400x400.jpg
- @featherw8money: https://pbs.twimg.com/profile_images/2104578989008228352/Kmq_pToI_400x400.jpg

## Traits (from Chikn metadata)

- #7897 (@Chodi_avax): head: sucker, neck: mim bling, tail: red plumage, body: rustic brown, background: cornhusk
- #2252 (@CryptoQuine): torso: blue bag, feet: red feet, tail: golden egg, body: rustic brown, background: cornhusk
- #5644 (@grenvilleriley): head: sucker, neck: purple bowtie, torso: blue bag, tail: very fresh egg, body: passion red, background: turquoisey
- #465 (@struccc): head: pillager, neck: chains for days, tail: liarliar, body: nightstalker blue, background: cornhusk
- #783 (@0xAinur): head: sucker, neck: avax bling, torso: mighty broadsword, feet: red vans, tail: liarliar, body: nightstalker blue, trim: space trim, background: cornhusk
- #5418 (@CryptoApe16): head: nerdlinger, neck: red bowtie, torso: big bag of cash, feet: green feet, body: mutant purple, background: plum
- #2144 (@steeeevO_crypto): neck: red bandana, feet: real feet, tail: very fresh egg, body: rustic brown, background: cornhusk

## Caveats

- **Owner check:** a matching PFP doesn't prove the X user owns that token. People use art they don't own.
- **steeeevO_crypto:** the avatar is an edited, bodybuilder version. `chikn-2144.png` is the official art of the token it's based on, which matched on all five traits.
- **featherw8money:** a custom edit (gold DEGEN chain, briefcases, sunglasses, chart background) that matches no token. `pfp-featherw8money.png` is cut out from the 400x400 avatar, so it's softer than the others. Whoever made the edit may hold rights in it beyond Chikn's.
- **struccc:** only replied "bok bok" in $HEGG threads and never wrote the word HEGG.
- **Chikn metadata can change:** Chikn metadata is upgradable. Names, bios and images can change later. The sha256 of each source is recorded above.
