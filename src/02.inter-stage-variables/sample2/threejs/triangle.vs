#version 300 es

in vec3 position;

void main() {
  const vec2[3] pos = vec2[](
    vec2( 0.0,  0.5),
    vec2(-0.5, -0.5),
    vec2( 0.5, -0.5)
  );

  gl_Position = vec4(pos[gl_VertexID], 0, 1);
}