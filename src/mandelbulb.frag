precision highp float;

const float EPS = 0.0004;
const float ZOOM = 6.5;
const float HUE = 1.9;
const float FOCUS = 1.9;
const float SATURATION = 0.7;
const int MAX_STEPS = 80;
const float MAX_STEPS_F = float(MAX_STEPS);
const int NUM_ITERATIONS = 8;
const vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);

uniform vec2 screenRes;
uniform vec2 mousePos;

uniform vec3 cameraPos;
uniform vec3 cameraDir;
uniform vec3 cameraRight;

uniform float colorValue;
uniform float exponent;

struct Distance {
	float value;
	float min;
};

vec3 hsv2rgb(float x, float y, float z) {
	vec3 p = abs(fract(vec3(x) + K.xyz) * 6.0 - K.www);
	return z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), y);
}

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
	return Distance(r * log(r) * 0.5 / length(d), b);
}

float light(int i) {
	return 1.0 - float(i) / MAX_STEPS_F;
}

vec3 raymarch(vec3 p, vec3 dir) {
	Distance dist = mandelbulb(p);
	float eps = EPS * dist.value / ZOOM;

	for (int i = 0; i < MAX_STEPS; i += 2) {
		float d = dist.value;
		if (d <= eps) {
			return hsv2rgb(dist.min * HUE, SATURATION, colorValue * 1.3) * light(i);
		}
		p += dir * d * 2.0;
		dist = mandelbulb(p);
	}
	return vec3(0.0);
}

void main(void) {
	float res = min(screenRes.x, screenRes.y);
	float distortionRadius = res / 12.0;
	vec2 mouseVector = gl_FragCoord.xy - mousePos;
	vec2 vecDirection = normalize(mouseVector);
	float dist = length(mouseVector);
	float clampedDistortion = clamp(dist, 0.0, distortionRadius) - distortionRadius;
	vec2 coord = gl_FragCoord.xy + (vecDirection * clampedDistortion * 2.0);
	vec2 pos = (coord * 2.0 - screenRes) / res;

	vec3 cameraUp = normalize(cross(cameraRight, cameraDir));
	vec3 cameraCenter = cameraPos + normalize(cameraRight * pos.x + cameraUp * pos.y + cameraDir * ZOOM) * FOCUS;
	vec3 rayDir = normalize(cameraCenter - cameraPos);

	vec3 color = raymarch(cameraPos, rayDir);

	gl_FragColor = vec4(color, 1.0);
}
