name: Contrib miner

on:
  schedule:
    - cron: "17 3 * * *"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  miner:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: write
    steps:
      - uses: aserenaa/contrib-miner@v1
        with:
          github_user_name: ${{ github.repository_owner }}
          output: dist/miner.gif
          light_output: dist/miner-light.gif

      - name: Publish to the output branch
        working-directory: dist
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          git init -q -b output
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -qm "Update miner GIFs"
          git push -qf "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" output# 🪨 nicholasnatividad818-oss

## Contribution Mining

![Contribution Miner](https://raw.githubusercontent.com/nicholasnatividad818-oss/nicholasnatividad818-oss/output/miner.gif)

![Contribution Miner Light](https://raw.githubusercontent.com/nicholasnatividad818-oss/nicholasnatividad818-oss/output/miner-light.gif)

*Updated daily via GitHub Actions*
