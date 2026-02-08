/**
 * Sprite asset loader for the Pixi isometric map
 * Loads single-frame PNG sprites from /public/assets/sprites
 */

import { Assets, Texture } from 'pixi.js';

export type GameSpriteKey =
  | 'island'
  | 'building1'
  | 'building2'
  | 'treasury'
  | 'shard'
  | 'stairsTopLeft'
  | 'stairsTopRight'
  | 'cloud1'
  | 'cloud2';

export type GameSpriteTextures = Record<GameSpriteKey, Texture>;

const SPRITE_URLS: Record<GameSpriteKey, string> = {
  island: '/assets/sprites/island.png',
  building1: '/assets/sprites/building1.png',
  building2: '/assets/sprites/building2.png',
  treasury: '/assets/sprites/treasury-building.png',
  shard: '/assets/sprites/shard-building.png',
  stairsTopLeft: '/assets/sprites/stairs-topleft.png',
  stairsTopRight: '/assets/sprites/stairs-topright.png',
  cloud1: '/assets/sprites/cloud1.png',
  cloud2: '/assets/sprites/cloud2.png',
};

export async function loadGameSpriteTextures(): Promise<GameSpriteTextures> {
  // Reset the asset cache so textures are re-created for the current WebGL context.
  // Without this, a page refresh or Application remount returns stale textures
  // bound to a destroyed context, rendering them blank.
  Assets.reset();

  const entries = await Promise.all(
    (Object.keys(SPRITE_URLS) as GameSpriteKey[]).map(async (key) => {
      const asset = (await Assets.load(SPRITE_URLS[key])) as Texture | { texture?: Texture };
      const texture = asset instanceof Texture ? asset : asset.texture;
      if (!texture) {
        throw new Error(`Failed to load texture for "${key}"`);
      }
      return [key, texture] as const;
    })
  );

  return entries.reduce((acc, [key, texture]) => {
    acc[key] = texture;
    return acc;
  }, {} as GameSpriteTextures);
}
