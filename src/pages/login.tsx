import { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';


const LoginPage = () => {
	const [email, setEmail] = useState<string>('');
	const [password, setPassword] = useState<string>('');
	const { token, currentUser, updateToken, updateUserInfo } = useContext(AppContext);

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
			const res = await fetch(process.env.API_URL + 'api/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			const data = await res.json();
			if (res.status === 200) {
				updateToken(data.token);
				updateUserInfo({
					idUsers: data.user.idUsers,
					fullName: data.user.fullName,
					profileImage: data.user.profileImage,
					email: data.user.email,
					phoneNumber: data.user.phoneNumber,
					userType: data.user.userType
				});
			} else {
				console.log('Login failed');
			}

		} catch (err) {
			console.log(err);
		}
	};

	return (
		<div className='loginContainer'>
			<form className='loginForm' onSubmit={handleSubmit}>
				<h2>Login</h2>
				<div className='loginFormGroup'>
					<label htmlFor="email">Email:</label>
					<input type="email" id="email" value={email} onChange={handleEmailChange} />
				</div>
				<div className='loginFormGroup'>
					<label htmlFor="password">Password:</label>
					<input type="password" id="password" value={password} onChange={handlePasswordChange} />
				</div>
				<button type="submit">Login</button>
			</form>
		</div>
	);
};

export default LoginPage;
