#version 300 es

in vec3 position;

uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;

out vec2 vTexCoord;

void main() {
  const vec2[6] pos = vec2[](
    vec2(0, 0),
    vec2(1, 0),
    vec2(0, 1),

    vec2(0, 1),
    vec2(1, 0),
    vec2(1, 1)
  );

  vec2 xy = pos[gl_VertexID];
  vTexCoord = xy * vec2(1, 50);

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(xy, 0, 1);
}