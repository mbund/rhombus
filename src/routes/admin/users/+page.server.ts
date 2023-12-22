import prisma from '$lib/db.js';
import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	if (!locals.session) {
		throw redirect(302, '/signin');
	}

	const user = await prisma.user.findUnique({
		where: {
			id: locals.session.id
		},
		select: {
			isAdmin: true
		}
	});

	if (!user?.isAdmin) {
		throw redirect(302, '/account');
	}

	const users = await prisma.user.findMany({
		select: {
			id: true,
			discord: {
				select: {
					image: true,
					username: true,
					globalUsername: true
				}
			},
			emails: {
				take: 1,
				select: {
					email: true
				}
			},
			isAdmin: true,
			team: {
				select: {
					name: true,
					id: true
				}
			}
		}
	});

	return {
		users: users.map((user) => ({
			id: user.id,
			isAdmin: user.isAdmin,
			email: user.emails[0]?.email,
			teamName: user.team!.name,
			teamId: user.team!.id,
			discord: user.discord
		}))
	};
};
