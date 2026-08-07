struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

struct Uniforms {
  brightness: f32,
  contrast: f32,
  @align(16) duotone: f32,
  @align(16) duotoneColor1: vec3f,
  @align(16) duotoneColor2: vec3f,
};

@group(0) @binding(0) var postTexture2d: texture_2d<f32>;
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var<uniform> uni: Uniforms;

@vertex 
fn vs(@builtin(vertex_index) vertexIndex : u32) -> VSOutput {
  var pos = array(
    vec2f(-1, -1),
    vec2f(-1,  3),
    vec2f( 3, -1),
  );

  var vsOutput: VSOutput;
  let xy = pos[vertexIndex];
  vsOutput.position = vec4f(xy, 0, 1);
  vsOutput.texcoord = xy * vec2f(0.5) + vec2f(0.5);
  return vsOutput;
}

@fragment 
fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
  let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
  var rgb = color.rgb;
  rgb = adjustBrightness(rgb, uni.brightness);
  rgb = adjustContrast(rgb, uni.contrast);
  rgb = mix(rgb, applyDuotone(rgb, uni.duotoneColor1, uni.duotoneColor2), uni.duotone);
  return vec4f(rgb, color.a);
}

fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

fn applyDuotone(color: vec3f, color1: vec3f, color2: vec3f) -> vec3f {
  let l = luminance(color);
  return mix(color1, color2, l);
}

// =========================

fn adjustBrightness(color: vec3f, brightness: f32) -> vec3f {
  return color + brightness;
}

fn adjustContrast(color: vec3f, contrast: f32) -> vec3f {
  let c = contrast + 1.;
  return clamp(0.5 + c * (color - 0.5), vec3f(0), vec3f(1));
}