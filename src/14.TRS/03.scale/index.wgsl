struct Uniforms {
  color: vec4f,
  resolution: vec2f,
  translation: vec2f,
  rotation: vec2f,
  scale: vec2f,
}

struct Vertex {
  @location(0) position: vec2f,
}

struct VSOut {
  @builtin(position) position: vec4f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(vert: Vertex) -> VSOut {
  var vsOut: VSOut;

  let scalePosition = vert.position * uni.scale;

  let rotationPosition = vec2f(
    scalePosition.x * uni.rotation.x - scalePosition.y * uni.rotation.y,
    scalePosition.x * uni.rotation.y + scalePosition.y * uni.rotation.x,
  );

  let position = rotationPosition + uni.translation;

  let zeroToOne = position / uni.resolution;
  let zeroToTwo = zeroToOne * 2;
  let flippedClipSpace = zeroToTwo - 1;
  let clipSpace = flippedClipSpace * vec2f(1, -1);

  vsOut.position = vec4f(clipSpace, 0, 1);
  return vsOut;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  return uni.color;
}