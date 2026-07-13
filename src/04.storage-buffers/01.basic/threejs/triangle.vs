#version 300 es

in vec3 position;

uniform sampler2D dataMap;
uniform float dataOffset;
uniform float dataPx;

out vec4 vColor;

void main() {
  const vec2[3] pos = vec2[](
    vec2( 0.0,  0.5),
    vec2(-0.5, -0.5),
    vec2( 0.5, -0.5)
  );

  vec2 center = vec2(dataPx, 1) * 0.5;

  vColor = vec4(
    texture(dataMap, vec2(dataOffset + dataPx * 0., 0) + center).x,
    texture(dataMap, vec2(dataOffset + dataPx * 1., 0) + center).x,
    texture(dataMap, vec2(dataOffset + dataPx * 2., 0) + center).x,
    texture(dataMap, vec2(dataOffset + dataPx * 3., 0) + center).x
  );

  vec2 offset = vec2(
    texture(dataMap, vec2(dataOffset + dataPx * 4., 0) + center).x,
    texture(dataMap, vec2(dataOffset + dataPx * 5., 0) + center).x
  );
  
  vec2 scale = vec2(
    texture(dataMap, vec2(dataOffset + dataPx * 6., 0) + center).x,
    texture(dataMap, vec2(dataOffset + dataPx * 7., 0) + center).x
  );

  gl_Position = vec4(pos[gl_VertexID] * scale + offset, 0, 1);
}