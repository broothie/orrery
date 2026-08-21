# Orrery

An interactive, true-scale model of the Solar System. Planetary positions are
calculated entirely in the browser with Astronomy Engine; the application has
no runtime backend or external data dependency.

## Features

- True-scale body radii and heliocentric distances
- Pan, orbit, and zoom controls across Solar System scales
- Screen-space indicators for off-screen and sub-pixel bodies
- Focused, camera-relative coordinates for close-up stability
- Reversible playback and date scrubbing from 1800 through 2200
- Simple colored spheres with the Sun as the light source
- Real magnitude- and color-index-based stars from the HYG catalog
- Static Vite output suitable for GitHub Pages

## Development

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Run validation with:

```sh
npm test
npm run lint
npm run build
```

Regenerate the checked-in magnitude-limited star catalog with:

```sh
npm run build:stars
```

## GitHub Pages

The included workflow deploys `dist/` whenever `main` is pushed. In the GitHub
repository settings, select **GitHub Actions** as the Pages source. The Vite
build uses relative asset URLs, so it works from a repository subpath or a
custom domain.

## Coordinate and scale model

Astronomy Engine heliocentric J2000 vectors are rotated into the J2000 ecliptic
frame and mapped to a Y-up Three.js scene. One render unit equals one million
kilometers. The scene is rebased around the focused body so nearby geometry
remains stable even for outer planets.

The star field uses a magnitude 7 subset of the HYG Stellar Database v4.0,
converted to J2000 ecliptic directions and rendered as one GPU point cloud.
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and
licensing.
