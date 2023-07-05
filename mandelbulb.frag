precision highp float;

const float SQRT3 = 1.7320508;
const float EPS = 0.0004;
const int MAX_STEPS = 80;
const int NUM_ITERATIONS = 8;

uniform vec2 screenRes;
uniform vec2 randSeed;
uniform vec2 mousePos;

uniform vec3 cameraPos;
uniform vec3 cameraDir;
uniform vec3 cameraRight;
uniform float cameraSpeed;

uniform float bokeh;
uniform float cameraFocus;
uniform float cameraZoom;

uniform float hueScale;
uniform float saturation;
uniform float colorValue;

uniform float exponent;
uniform int maxSteps;

vec2 randCoord;

float rand() {
	float x = fract(sin(dot(randCoord, vec2(182.8497, -2154.9248))) * 38223.19);
	randCoord += vec2(x);
	return x;
}
vec2 randHexagon() {
	vec2 v1 = vec2(1.0, 0.0), v2 = vec2(-0.5, SQRT3 * 0.5);
	vec2 v = v1 * rand() + v2 * rand();  // random point on a rhombus, 1/3 of a hexagon
	float a = rand() * 3.0;
	if (a < 1.0) {
		v = mat2(-0.5, -SQRT3 * 0.5, SQRT3 * 0.5, -0.5) * v;  // rotate 120 degrees
	} else if (a < 2.0) {
		v = mat2(-0.5, SQRT3 * 0.5, -SQRT3 * 0.5, -0.5) * v;  // rotate 240 degrees
	}
	return v;
}
vec3 hsv2rgb(float x, float y, float z) {
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(vec3(x) + K.xyz) * 6.0 - K.www);
	return z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), y);
}
vec3 hsv2rgb(vec3 c) {
	return hsv2rgb(c.x, c.y, c.z);
}
struct Distance {
	float value;
	vec3 color;
};
Distance mandelbulb(vec3 p) {
	vec3 z = vec3(0.0);
	vec3 d = vec3(1.0);
	float r = 0.0;
	float b = 10000.0;

	for (int i = 0; i < NUM_ITERATIONS; ++i) {
		d = exponent * pow(r, exponent - 1.0) * d + 1.0;
		if (r > 0.0) {
			float phi = atan(z.z, z.x) * exponent;
			float theta = acos(z.y / r) * exponent;
			r = pow(r, exponent);
			z = vec3(cos(phi) * cos(theta), sin(theta), sin(phi) * cos(theta)) * r;
		}
		z += p;

		r = length(z);
		b = min(r, b);
		if (r >= 2.0) {
			break;
		}
	}
	return Distance(r * log(r) * 0.5 / length(d), hsv2rgb(vec3(b * hueScale, saturation, colorValue * 1.3)));
}

vec3 light(int i) {
	return vec3(1.0 - float(i) / float(maxSteps));
}

vec3 raymarch(vec3 p, vec3 dir) {
	Distance dist = mandelbulb(p);
	float eps = EPS * dist.value / cameraZoom;

	for (int i = 0; i < MAX_STEPS; ++i) {
		if (i == maxSteps) {
			break;
		}
		Distance dist = mandelbulb(p);
		float d = dist.value;

		if (d <= eps) {
			return dist.color * light(i);
		}
		p += dir * d;
	}
	return vec3(0.0);
}

void main(void) {
	float res = min(screenRes.x, screenRes.y);
	float distortionRadius = res / 24.0;
	vec2 mouseVector = gl_FragCoord.xy - mousePos;
	vec2 vecDirection = normalize(mouseVector);
	float dist = length(mouseVector);
	float clampedDistortion = clamp(dist, 0.0, distortionRadius) - distortionRadius;
	vec2 coord = gl_FragCoord.xy + (vecDirection * clampedDistortion * 2.0);
	vec2 pos = (coord * 2.0 - screenRes) / res;
	randCoord = randSeed + pos;

	pos += vec2(rand() * 2.0 - 1.0, rand() * 2.0 - 1.0) / res;

	vec3 cameraUp = normalize(cross(cameraRight, cameraDir));
	vec3 cameraCenter = cameraPos + normalize(cameraRight * pos.x + cameraUp * pos.y + cameraDir * cameraZoom) * cameraFocus * cameraSpeed;
	vec3 rayDir = normalize(cameraCenter - cameraPos);

	vec3 color = raymarch(cameraPos, rayDir);

	gl_FragColor = vec4(color, 1.0);
}
