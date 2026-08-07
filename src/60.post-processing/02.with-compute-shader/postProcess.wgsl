struct Uniforms {
  effectAmount: f32,
  bandMult: f32,
  cellMult: f32,
  cellBright: f32,
}

@group(0) @binding(0) var postTexture2d: texture_2d<f32>;
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var<uniform> uni: Uniforms;
@group(1) @binding(0) var outTexture: texture_storage_2d<bgra8unorm, write>;

@compute @workgroup_size(16, 16)
fn cs(@builtin(global_invocation_id) gid: vec3u) {
  let outSize = textureDimensions(outTexture);

  if (gid.x >= outSize.x || gid.y >= outSize.y) {
    return;
  }

  let banding = abs(sin(f32(gid.y) * uni.bandMult));

  let cellNdx = u32(f32(gid.x) * uni.cellMult) % 3;
  var cellColor = vec3f(0);
  cellColor[cellNdx] = 1.;
  let cMult = cellColor + uni.cellBright;

  let effect = mix(vec3f(1), banding * cMult, uni.effectAmount);
  let uv = (vec2f(gid.xy) + 0.5) / vec2f(outSize);
  let color = textureSampleLevel(postTexture2d, postSampler, uv, 0);
  textureStore(outTexture, gid.xy, vec4f(color.rgb * effect, color.a));
}