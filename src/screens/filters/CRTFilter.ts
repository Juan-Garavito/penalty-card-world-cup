import { Filter } from "pixi.js";

const FRAG = `
  in vec2 vTextureCoord;
  out vec4 finalColor;
  uniform sampler2D uTexture;
  uniform vec4 uInputSize;
  uniform float uTime;

  // Cheap pseudo-random noise for film grain.
  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    float h = uInputSize.y > 0.0 ? uInputSize.y : 720.0;

    // Shrink the image toward the centre (uniform bezel border) and curve it
    // outward toward the corners (barrel distortion). Both push UVs outside
    // [0,1], which is painted black — giving a smaller, curved screen framed
    // by a visible black border with rounded corners.
    vec2  cc    = vTextureCoord - 0.5;
    float dist2 = dot(cc, cc);
    vec2  uv    = vTextureCoord + cc * (0.14 + dist2 * 0.45);

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      finalColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    // Chromatic aberration — sample R/B a little off-centre (growing toward
    // the edges) so colour fringes appear, like a mistuned analog signal.
    vec2 caOffset = cc * dist2 * 0.02;
    float r = texture(uTexture, uv + caOffset).r;
    float g = texture(uTexture, uv).g;
    float b = texture(uTexture, uv - caOffset).b;
    float a = texture(uTexture, uv).a;
    vec4 color = vec4(r, g, b, a);

    // Phosphor yellow-amber tint — pushed harder for a stronger sepia glow.
    color.r *= 1.18;
    color.g *= 0.96;
    color.b *= 0.45;

    // Scanlines — 45% darkening every other row
    float line     = mod(floor(uv.y * h), 2.0);
    float scanDark = 1.0 - 0.45 * line;
    color.rgb *= scanDark;

    // Film grain — bounded uTime keeps sin() precision stable over long sessions.
    float grain = rand(uv * h + mod(uTime, 1000.0) * 60.0);
    color.rgb += (grain - 0.5) * 0.08;

    // Animated TV refresh band sweeping top to bottom (~4.5s cycle)
    float bandY    = mod(uTime * 0.22, 1.0);
    float bandDist = abs(uv.y - bandY);
    float band     = smoothstep(0.06, 0.0, bandDist) * 0.28;
    color.rgb += band;

    // Vignette
    vec2  vigUv    = uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(vigUv * vec2(0.45, 0.6), vigUv * vec2(0.45, 0.6));
    vignette        = clamp(vignette, 0.0, 1.0);
    color.rgb      *= mix(0.45, 1.0, vignette);

    finalColor = vec4(color.rgb, color.a);
  }
`;

export function createCRTFilter(): Filter {
  return Filter.from({
    gl: { fragment: FRAG },
    resources: {
      crtUniforms: {
        uTime: { value: 0, type: "f32" },
      },
    },
  });
}
