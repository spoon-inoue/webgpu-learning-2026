struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

struct Uniforms {
  effectAmount: f32,
  bandMult: f32,
  cellMult: f32,
  cellBright: f32,
}

@group(0) @binding(0) var postTexture2d: texture_2d<f32>;
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var<uniform> uni: Uniforms;

@vertex 
fn vs(@builtin(vertex_index) vi : u32) -> VSOut {
  var pos = array(
    vec2f(-1, -1),
    vec2f(-1,  3),
    vec2f( 3, -1),
  );
  var vsOutput: VSOut;
  let xy = pos[vi];
  vsOutput.position = vec4f(xy, 0, 1);
  vsOutput.texcoord = xy * vec2f(0.5, -0.5) + vec2f(0.5);
  return vsOutput;
}

@fragment 
fn fs2d(fsIn: VSOut) -> @location(0) vec4f {
  let banding = abs(sin(fsIn.position.y * uni.bandMult));

  let cellNdx = u32(fsIn.position.x * uni.cellMult) % 3;
  var cellColor = vec3f(0);
  cellColor[cellNdx] = 1.;
  let cMult = cellColor + uni.cellBright;

  let effect = mix(vec3f(1), banding * cMult, uni.effectAmount);
  let color = textureSample(postTexture2d, postSampler, fsIn.texcoord);
  return vec4f(color.rgb * effect, color.a);
}