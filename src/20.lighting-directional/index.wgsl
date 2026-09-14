struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
}

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOut {
  return VSOut(
    uni.worldViewProjection * vert.position,
    uni.normalMatrix * vert.normal,
  );
}

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  let light = dot(normal, -uni.lightDirection);
  let color = uni.color.rgb * light;
  return vec4f(color, uni.color.a);
}