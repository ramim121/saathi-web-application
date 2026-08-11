import type { GetServerSidePropsContext } from "next";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@/config/constants";
import JWTPayload from "@/types/JWTPayload";

/**
 * Auth guard for pages that fetch data inside `getServerSideProps`.
 *
 * The API routes are guarded, but a page that queries Sequelize directly in
 * `getServerSideProps` bypasses them entirely: whatever it returns in `props`
 * is serialised into `__NEXT_DATA__` and shipped to whoever requested the URL,
 * logged in or not. `/users` did exactly that — every user row, including
 * email, phone, NID number and linked bank accounts, was readable by an
 * anonymous GET. The client-side layout redirect does not help, because the
 * data is already in the HTML by the time the browser runs any JavaScript.
 *
 * The browser sends the JWT as the `saathi-token` cookie (see utils/Fetch.ts),
 * so that is what we read here — there is no Authorization header on a document
 * request.
 */
export type PageAuth = {
    idUsers: number;
    userType: string;
};

export function readPageAuth(context: GetServerSidePropsContext): PageAuth | null {
    const token = context.req.cookies?.["saathi-token"];
    if (!token) return null;

    try {
        const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
        if (!payload?.idUsers) return null;
        return { idUsers: Number(payload.idUsers), userType: String(payload.userType ?? "") };
    } catch {
        // Expired or tampered token is simply "not authenticated".
        return null;
    }
}

/** Redirect used when a page needs an admin and does not have one. */
export const redirectToLogin = {
    redirect: { destination: "/login", permanent: false },
} as const;

export function requireAdminPage(context: GetServerSidePropsContext): PageAuth | null {
    const auth = readPageAuth(context);
    if (!auth || auth.userType !== "admin") return null;
    return auth;
}
