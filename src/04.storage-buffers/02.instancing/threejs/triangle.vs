#version 300 es

in vec3 position;

uniform sampler2D staticDataMap;
uniform float staticDataPx;
uniform sampler2D changingDataMap;
uniform float changingDataPx;
uniform float kNumObjects;

out vec4 vColor;

void main() {
  const vec2[3] pos = vec2[](
    vec2( 0.0,  0.5),
    vec2(-0.5, -0.5),
    vec2( 0.5, -0.5)
  );

  float dataOffset = float(gl_InstanceID) / kNumObjects;

  // static
  vec2 staticCenter = vec2(staticDataPx, 1) * 0.5;

  vColor = vec4(
    texture(staticDataMap, vec2(dataOffset + staticDataPx * 0., 0) + staticCenter).x,
    texture(staticDataMap, vec2(dataOffset + staticDataPx * 1., 0) + staticCenter).x,
    texture(staticDataMap, vec2(dataOffset + staticDataPx * 2., 0) + staticCenter).x,
    texture(staticDataMap, vec2(dataOffset + staticDataPx * 3., 0) + staticCenter).x
  );

  vec2 offset = vec2(
    texture(staticDataMap, vec2(dataOffset + staticDataPx * 4., 0) + staticCenter).x,
    texture(staticDataMap, vec2(dataOffset + staticDataPx * 5., 0) + staticCenter).x
  );

  // changing
  vec2 changingCenter = vec2(changingDataPx, 1) * 0.5;
  
  vec2 scale = vec2(
    texture(changingDataMap, vec2(dataOffset + changingDataPx * 0., 0) + changingCenter).x,
    texture(changingDataMap, vec2(dataOffset + changingDataPx * 1., 0) + changingCenter).x
  );

  gl_Position = vec4(pos[gl_VertexID] * scale + offset, 0, 1);
}