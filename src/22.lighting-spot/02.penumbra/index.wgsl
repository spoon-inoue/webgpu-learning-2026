struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
  lightDirection: vec3f,
  innerLimit: f32,
  outerLimit: f32,
}

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) surfaceToLight: vec3f,
  @location(2) surfaceToView: vec3f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOut {
  let surfaceWorldPosition = (uni.world * vert.position).xyz;

  return VSOut(
    uni.worldViewProjection * vert.position,       // position
    uni.normalMatrix * vert.normal,                // normal
    uni.lightWorldPosition - surfaceWorldPosition, // surfaceToLight
    uni.viewWorldPosition - surfaceWorldPosition,  // surfaceToView
  );
}

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  let normal = normalize(in.normal);

  let surfaceToLightDirection = normalize(in.surfaceToLight);
  let surfaceToViewDirection = normalize(in.surfaceToView);
  let halfVector = normalize(surfaceToLightDirection + surfaceToViewDirection);

  let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
  // let limitRange = uni.innerLimit - uni.outerLimit;
  // let inLight = saturate((dotFromDirection - uni.outerLimit) / limitRange);
  let inLight = smoothstep(uni.outerLimit, uni.innerLimit, dotFromDirection);

  let light = inLight * dot(normal, surfaceToLightDirection);

  var specular = dot(normal, halfVector);
  specular = inLight * select(0.0, pow(specular, uni.shininess), specular > 0.0);
  
  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}