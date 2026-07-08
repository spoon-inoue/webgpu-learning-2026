#version 300 es

in vec3 position;

out vec4 vColor;

void main() {
  const vec2[3] pos = vec2[](
    vec2( 0.0,  0.5),
    vec2(-0.5, -0.5),
    vec2( 0.5, -0.5)
  );
  const vec4[3] color = vec4[](
    vec4(1, 0, 0, 1),
    vec4(0, 1, 0, 1),
    vec4(0, 0, 1, 1)
  );

  vColor = color[gl_VertexID];
  gl_Position = vec4(pos[gl_VertexID], 0, 1);
}