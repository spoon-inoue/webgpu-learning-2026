struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

struct Uniforms {
  brightness: f32,
  contrast: f32,
  gradient: f32,
};

@group(0) @binding(0) var postTexture2d: texture_2d<f32>;
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var<uniform> uni: Uniforms;
@group(1) @binding(0) var lut: texture_2d<f32>;
@group(1) @binding(1) var lutSampler: sampler;

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
  rgb = mix(rgb, apply1DLUT(rgb, lut, lutSampler), uni.gradient);
  return vec4f(rgb, color.a);
}

fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

fn apply1DLUT(color: vec3f, lut: texture_2d<f32>, smp: sampler) -> vec3f {
  let l = luminance(color);
  let width = f32(textureDimensions(lut, 0).x);
  let range = (width - 1) / width;
  let u = 0.5 / width + l * range;
  return textureSample(lut, smp, vec2f(u, 0.5)).rgb;
}

// =========================

fn adjustBrightness(color: vec3f, brightness: f32) -> vec3f {
  return color + brightness;
}

fn adjustContrast(color: vec3f, contrast: f32) -> vec3f {
  let c = contrast + 1.;
  return clamp(0.5 + c * (color - 0.5), vec3f(0), vec3f(1));
}