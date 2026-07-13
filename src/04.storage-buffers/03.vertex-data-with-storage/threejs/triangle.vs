#version 300 es

in vec3 position;

struct Data {
  sampler2D map;
  float px;
};

uniform Data staticData;
uniform Data changingData;
uniform Data vertexData;

uniform float kNumObjects;
uniform float kNumVertices;

out vec4 vColor;

void main() {
  float instanceOffset = float(gl_InstanceID) / kNumObjects;
  float vertexOffset = float(gl_VertexID) / kNumVertices;

  // static
  vec2 staticCenter = vec2(staticData.px, 1) * 0.5;

  vColor = vec4(
    texture(staticData.map, vec2(instanceOffset + staticData.px * 0., 0) + staticCenter).x,
    texture(staticData.map, vec2(instanceOffset + staticData.px * 1., 0) + staticCenter).x,
    texture(staticData.map, vec2(instanceOffset + staticData.px * 2., 0) + staticCenter).x,
    texture(staticData.map, vec2(instanceOffset + staticData.px * 3., 0) + staticCenter).x
  );

  vec2 offset = vec2(
    texture(staticData.map, vec2(instanceOffset + staticData.px * 4., 0) + staticCenter).x,
    texture(staticData.map, vec2(instanceOffset + staticData.px * 5., 0) + staticCenter).x
  );

  // changing
  vec2 changingCenter = vec2(changingData.px, 1) * 0.5;
  
  vec2 scale = vec2(
    texture(changingData.map, vec2(instanceOffset + changingData.px * 0., 0) + changingCenter).x,
    texture(changingData.map, vec2(instanceOffset + changingData.px * 1., 0) + changingCenter).x
  );

  // vertex
  vec2 vertexCenter = vec2(vertexData.px, 1) * 0.5;
  
  vec2 pos = vec2(
    texture(vertexData.map, vec2(vertexOffset + vertexData.px * 0., 0) + vertexCenter).x,
    texture(vertexData.map, vec2(vertexOffset + vertexData.px * 1., 0) + vertexCenter).x
  );

  gl_Position = vec4(pos * scale + offset, 0, 1);
}