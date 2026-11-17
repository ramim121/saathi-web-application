import { useState, useContext } from 'react';
import Head from 'next/head';
import { AppContext } from '../context/AppContext';
import { API_URL } from '@/config/public';
import Cookies from "js-cookie";
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { inter } from '@/ui/font';
import { cx } from '@/ui/primitives';

/**
 * Admin sign-in. Redesigned 2026-11-17 (Tailwind); the sign-in itself is
 * unchanged: POST api/login, store the token in the `saathi-token` cookie,
 * remember the user, go to the dashboard — or show the server's message.
 */
const LoginPage = () => {
	const [email, setEmail] = useState<string>('');
	const [password, setPassword] = useState<string>('');
	const [showPassword, setShowPassword] = useState(false);
	const { updateUserInfo } = useContext(AppContext);
	const [loading, setLoading] = useState<boolean>(false);
	const router = useRouter();

	const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setEmail(e.target.value);
	};

	const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setPassword(e.target.value);
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = {
			email: email,
			password: password
		};

		try {
			setLoading(true);
			const res = await fetch(API_URL + 'api/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			const data = await res.json();
			if (res.status === 200) {
				Cookies.set('saathi-token', data.token);
				updateUserInfo({
					idUsers: data.user.idUsers,
					fullName: data.user.fullName,
					profileImage: data.user.profileImage,
					email: data.user.email,
					phoneNumber: data.user.phoneNumber,
					userType: data.user.userType
				});
				router.push('/');
			} else {
				Swal.fire({
					icon: 'error',
					title: 'Error',
					html: data.message,
				});
			}
			setLoading(false);

		} catch (err: any) {
			Swal.fire({
				icon: 'error',
				title: 'Error',
				text: err.message,
			});
			setLoading(false);
		}
	};

	const field =
		'tw-w-full tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white tw-py-2.5 tw-pl-10 tw-pr-3 tw-text-sm tw-text-slate-900 tw-shadow-sm tw-outline-none tw-transition placeholder:tw-text-slate-400 focus:tw-border-brand-500 focus:tw-ring-4 focus:tw-ring-brand-500/10';

	return (
		<>
			<Head>
				<title>Sign in · Shathi admin</title>
				<meta content="width=device-width, initial-scale=1" name="viewport" />
			</Head>
			<div className={cx(inter.variable, 'ui tw-grid tw-min-h-screen tw-bg-white lg:tw-grid-cols-[1.05fr_1fr]')}>
				{/* Brand panel */}
				<div className="tw-relative tw-hidden tw-overflow-hidden tw-bg-gradient-to-br tw-from-[#0b1238] tw-via-[#0a1033] tw-to-[#06291c] lg:tw-flex lg:tw-flex-col lg:tw-justify-between lg:tw-p-12">
					<div className="tw-pointer-events-none tw-absolute -tw-right-24 -tw-top-24 tw-h-96 tw-w-96 tw-rounded-full tw-bg-emerald-500/20 tw-blur-3xl" aria-hidden />
					<div className="tw-pointer-events-none tw-absolute -tw-bottom-32 -tw-left-20 tw-h-96 tw-w-96 tw-rounded-full tw-bg-indigo-500/20 tw-blur-3xl" aria-hidden />
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src="/assets/images/logo-header.png" alt="Shathi" className="tw-relative tw-h-12 tw-w-auto tw-self-start" />
					<div className="tw-relative tw-max-w-md">
						<h1 className="tw-text-3xl tw-font-semibold tw-leading-tight tw-tracking-tight tw-text-white">
							Every booking, investor and project — in one place.
						</h1>
						<p className="tw-mt-4 tw-text-[15px] tw-leading-relaxed tw-text-white/65">
							Confirm payments, track maturities and payouts, and keep partners and projects up to date.
						</p>
					</div>
					<p className="tw-relative tw-text-xs tw-text-white/40">Shathi · DigiGram Ventures</p>
				</div>

				{/* Form */}
				<div className="tw-flex tw-items-center tw-justify-center tw-px-6 tw-py-12 sm:tw-px-10">
					<div className="tw-w-full tw-max-w-sm">
						<div className="tw-mb-8 tw-flex tw-justify-center lg:tw-hidden">
							<span className="tw-rounded-2xl tw-bg-[#0b1238] tw-px-5 tw-py-3">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src="/assets/images/logo-header.png" alt="Shathi" className="tw-h-9 tw-w-auto" />
							</span>
						</div>
						<h2 className="tw-text-2xl tw-font-semibold tw-tracking-tight tw-text-slate-900">Sign in</h2>
						<p className="tw-mt-1.5 tw-text-sm tw-text-slate-500">Use your admin email and password.</p>

						<form onSubmit={handleSubmit} className="tw-mt-8 tw-space-y-5">
							<label className="tw-block" htmlFor="formBasicEmail">
								<span className="tw-mb-1.5 tw-block tw-text-sm tw-font-medium tw-text-slate-700">Email address</span>
								<span className="tw-relative tw-block">
									<Mail className="tw-pointer-events-none tw-absolute tw-left-3.5 tw-top-1/2 tw-h-4 tw-w-4 -tw-translate-y-1/2 tw-text-slate-400" aria-hidden />
									<input
										id="formBasicEmail"
										type="email"
										autoComplete="username"
										placeholder="you@digigramventures.com"
										value={email}
										onChange={handleEmailChange}
										required
										className={field}
									/>
								</span>
							</label>

							<label className="tw-block" htmlFor="formBasicPassword">
								<span className="tw-mb-1.5 tw-block tw-text-sm tw-font-medium tw-text-slate-700">Password</span>
								<span className="tw-relative tw-block">
									<Lock className="tw-pointer-events-none tw-absolute tw-left-3.5 tw-top-1/2 tw-h-4 tw-w-4 -tw-translate-y-1/2 tw-text-slate-400" aria-hidden />
									<input
										id="formBasicPassword"
										type={showPassword ? 'text' : 'password'}
										autoComplete="current-password"
										placeholder="Password"
										value={password}
										onChange={handlePasswordChange}
										required
										className={cx(field, 'tw-pr-10')}
									/>
									<button
										type="button"
										onClick={() => setShowPassword((s) => !s)}
										className="tw-absolute tw-right-2 tw-top-1/2 -tw-translate-y-1/2 tw-rounded-lg tw-p-1.5 tw-text-slate-400 hover:tw-bg-slate-100 hover:tw-text-slate-600"
										aria-label={showPassword ? 'Hide password' : 'Show password'}
									>
										{showPassword ? <EyeOff className="tw-h-4 tw-w-4" aria-hidden /> : <Eye className="tw-h-4 tw-w-4" aria-hidden />}
									</button>
								</span>
							</label>

							<button
								type="submit"
								disabled={loading}
								className="tw-inline-flex tw-w-full tw-items-center tw-justify-center tw-gap-2 tw-rounded-xl tw-bg-brand-700 tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-white tw-shadow-sm tw-transition hover:tw-bg-brand-600 focus-visible:tw-outline-none focus-visible:tw-ring-4 focus-visible:tw-ring-brand-500/25 disabled:tw-cursor-not-allowed disabled:tw-opacity-70"
							>
								{loading ? (
									<>
										<Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />
										Signing in…
									</>
								) : (
									'Sign in'
								)}
							</button>
						</form>
					</div>
				</div>
			</div>
		</>
	);
};

export default LoginPage;
