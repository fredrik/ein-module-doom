#!/bin/sh
# Fetches the shareware Doom IWAD (DOOM1.WAD, v1.9) into assets/doom1.wad and checks it.
#
# The file comes out of Debian's doom-wad-shareware package. Its SHA-1 and size are the ones
# Debian's game-data-packager lists for "doom1.wad?shareware" (data/doom.yaml), which in turn
# cites https://doomwiki.org/wiki/DOOM1.WAD. The WAD is id Software's and is not committed.
set -eu

url=https://deb.debian.org/debian/pool/non-free/d/doom-wad-shareware/doom-wad-shareware_1.9.fixed-5_all.deb
sha1=5b2e249b9c5133ec987b3ea77596381dc0d6bc1d
size=4196020

root=$(cd "$(dirname "$0")/.." && pwd)
target="$root/assets/doom1.wad"
if [ -e "$target" ]; then
  echo "$target is already there; remove it first to fetch it again"
  exit 0
fi

work=$(mktemp -d)
trap 'rm -r "$work"' EXIT
curl --fail --silent --show-error --location --output "$work/package.deb" "$url"
(cd "$work" && ar x package.deb && tar -xf data.tar.xz ./usr/share/games/doom/doom1.wad)
wad="$work/usr/share/games/doom/doom1.wad"

actual_sha1=$(shasum -a 1 "$wad" | cut -d' ' -f1)
actual_size=$(wc -c < "$wad" | tr -d ' ')
if [ "$actual_sha1" != "$sha1" ] || [ "$actual_size" != "$size" ]; then
  echo "doom1.wad does not check out: sha1 $actual_sha1, $actual_size bytes; expected $sha1, $size bytes" >&2
  exit 1
fi
mv "$wad" "$target"
echo "$target: shareware DOOM1.WAD v1.9, sha1 $sha1"
