struct Uniforms {
  projection: mat4x4f,
  view: mat4x4f,
  world: mat4x4f,
  cameraPosition: vec3f,
}

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var ourTexture: texture_cube<f32>;

@vertex fn vs(vert: Vertex) -> VSOut {
  var vsOut: VSOut;
  vsOut.position = uni.projection * uni.view * uni.world * vert.position;
  vsOut.worldPosition = (uni.world * vert.position).xyz;
  vsOut.worldNormal = (uni.world * vec4f(vert.normal, 0)).xyz;
  return vsOut;
}

@fragment fn fs(vsOut: VSOut) -> @location(0) vec4f {
  let worldNormal = normalize(vsOut.worldNormal);
  let eyeToSurfaceDir = normalize(vsOut.worldPosition - uni.cameraPosition);
  let direction = reflect(eyeToSurfaceDir, worldNormal);
  
  return textureSample(ourTexture, ourSampler, direction * vec3f(1, 1, -1));
}