struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
  let pos = array(
    vec2f(0, 0),
    vec2f(1, 0),
    vec2f(0, 1),

    vec2f(0, 1),
    vec2f(1, 0),
    vec2f(1, 1),
  );

  var vsOut: VSOut;
  let xy = pos[vertexIndex];
  vsOut.position = vec4f(xy, 0, 1);
  // vsOut.texcoord = xy;
  vsOut.texcoord = vec2(xy.x, 1. - xy.y);
  return vsOut;
}

@group(0) @binding(0) var ourSampler: sampler;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

@fragment
fn fs(fsIn: VSOut) -> @location(0) vec4f {
  return textureSample(ourTexture, ourSampler, fsIn.texcoord);
}