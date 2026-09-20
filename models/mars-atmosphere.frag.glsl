// GLSL ES fragment shader contract. Supply world-space position/normal and UV
// from the vertex shader. Bind the GLB's base-color texture as atmosphereMap.
// Material: alpha blending, depth test ON, depth write OFF, front faces only.
precision highp float;
uniform sampler2D atmosphereMap;
uniform vec3 cameraPosition;
varying vec3 worldPosition;
varying vec3 worldNormal;
varying vec2 atmosphereUv;
void main() {
    vec3 viewDirection = normalize(cameraPosition - worldPosition);
    float rim = pow(1.0 - abs(dot(normalize(worldNormal), viewDirection)), 5.0);
    vec3 referenceColor = texture2D(atmosphereMap, atmosphereUv).rgb;
    // Black in the reference is empty atmosphere, never opaque black geometry.
    vec3 dustColor = mix(vec3(0.55, 0.18, 0.06), referenceColor, 0.15);
    gl_FragColor = vec4(dustColor, 0.32 * rim);
}
