import { DISCORD_CLIENT_SECRET } from '$env/static/private';
import { PUBLIC_DISCORD_CLIENT_ID, PUBLIC_LOCATION_URL } from '$env/static/public';
import { z } from 'zod';
import { error, redirect } from '@sveltejs/kit';
import prisma from '$lib/db.js';
import { setJwt } from '$lib/serverAuth.js';

export async function GET({ url, cookies }) {
	if (url.searchParams.get('error')) {
		throw error(403, url.searchParams.get('error_description') ?? 'Oauth error');
	}

	const code = url.searchParams.get('code');
	if (!code) {
		throw error(403, 'Missing code url param');
	}

	const accessTokenResponse = await fetch('https://discord.com/api/oauth2/token', {
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Accept-Encoding': 'application/x-www-form-urlencoded'
		},
		method: 'POST',
		body: new URLSearchParams({
			client_id: PUBLIC_DISCORD_CLIENT_ID,
			client_secret: DISCORD_CLIENT_SECRET,
			grant_type: 'authorization_code',
			redirect_uri: `${PUBLIC_LOCATION_URL}/api/discord/callback`,
			code
		})
	});
	const accessTokenJson = await accessTokenResponse.json();
	if (accessTokenResponse.status !== 200) {
		throw new Error(JSON.stringify(accessTokenJson));
	}
	const accessToken = z
		.object({
			token_type: z.string(),
			access_token: z.string(),
			expires_in: z.number(),
			refresh_token: z.string(),
			scope: z.string()
		})
		.parse(accessTokenJson);

	const profileResponse = await fetch('https://discord.com/api/users/@me', {
		headers: {
			Authorization: `${accessToken.token_type} ${accessToken.access_token}`
		}
	});

	const profileJson = await profileResponse.json();
	if (profileResponse.status !== 200) {
		throw new Error(JSON.stringify(profileJson));
	}
	const profile = z
		.object({
			id: z.string(),
			email: z.string(),
			username: z.string(),
			avatar: z.nullable(z.string()),
			global_name: z.string(),
			discriminator: z.nullable(z.string())
		})
		.parse(profileJson);

	let image: string;
	if (profile.avatar === null) {
		const defaultAvatarNumber = parseInt(profile.discriminator!) % 5;
		image = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
	} else {
		const format = profile.avatar.startsWith('a_') ? 'gif' : 'png';
		image = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
	}

	const existing = await prisma.discord.findUnique({
		where: {
			id: profile.id
		},
		select: { userId: true }
	});

	const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

	if (existing) {
		const session = await prisma.session.create({
			data: {
				userId: existing.userId,
				expires
			}
		});
		await setJwt({ sessionId: session.id, expires }, cookies);
	} else {
		const user = await prisma.user.create({
			data: {
				discord: {
					create: {
						id: profile.id,
						username: profile.username,
						globalUsername: profile.global_name,
						email: profile.email,
						image
					}
				},
				emails: {
					create: {
						email: profile.email,
						verified: new Date()
					}
				},
				sessions: {
					create: {
						expires
					}
				}
			},
			select: { sessions: { select: { id: true } } }
		});

		await setJwt({ sessionId: user.sessions[0].id, expires }, cookies);
	}

	throw redirect(302, `/`);
}
