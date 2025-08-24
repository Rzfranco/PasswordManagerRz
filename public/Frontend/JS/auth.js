document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const registrationMessage = document.getElementById('registrationMessage');
    const loginForm = document.getElementById('loginForm'); // Obtener el formulario de login
    const loginMessage = document.getElementById('loginMessage'); // Obtener el elemento para mensajes de login

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const email = document.getElementById('email').value;

            const userData = { username, password, email };

            try {
                const response = await fetch('http://localhost:3000/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData),
                });
                const data = await response.json();

                if (response.ok) {
                    registrationMessage.className = 'message success';
                    registrationMessage.textContent = data.message;
                    setTimeout(() => { window.location.href = '/login.html'; }, 1000);
                } else {
                    registrationMessage.className = 'message error';
                    registrationMessage.textContent = data.errors?.map(err => err.msg).join(', ') || data.message || 'Error desconocido durante el registro.';
                }
            } catch (error) {
                registrationMessage.className = 'message error';
                registrationMessage.textContent = 'No se pudo conectar al servidor.';
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            const credentials = { username, password };

            try {
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(credentials),
                });
                const data = await response.json();

                if (response.ok) {
                    console.log('Inicio de sesión exitoso:', data);
                    loginMessage.className = 'message success';
                    loginMessage.textContent = data.message;
                    const token = data.token; // Guardar el token JWT
                    localStorage.setItem('authToken', token);
                    localStorage.setItem('userId', data.userId);
                    setTimeout(() => { window.location.href = '/passwords.html'; }, 1000); // Redirigir a la página principal
                } else {
                    loginMessage.className = 'message error';
                    loginMessage.textContent = data.message || 'Credenciales inválidas.';
                }
            } catch (error) {
                loginMessage.className = 'message error';
                loginMessage.textContent = 'No se pudo conectar al servidor.';
            }
        });
    }
});

//forgotpassword.js
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const registrationMessage = document.getElementById('registrationMessage');
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm'); // Obtener el formulario de olvido de contraseña
    const forgotPasswordMessage = document.getElementById('forgotPasswordMessage'); // Obtener el elemento para mensajes de olvido de contraseña

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            // ... (tu código existente para el registro) ...
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            // ... (tu código existente para el inicio de sesión) ...
        });
    }

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const email = document.getElementById('email').value;

            try {
                const response = await fetch('http://localhost:3000/api/forgot-password', { // Define la ruta en tu backend
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                });
                const data = await response.json();

                if (response.ok) {
                    forgotPasswordMessage.className = 'message success';
                    forgotPasswordMessage.textContent = data.message || 'Se ha enviado un enlace de restablecimiento a tu correo electrónico.';
                    // Puedes redirigir al usuario a una página de confirmación si lo deseas
                } else {
                    forgotPasswordMessage.className = 'message error';
                    forgotPasswordMessage.textContent = data.message || 'No se pudo enviar el enlace de restablecimiento. Verifica tu correo electrónico.';
                }
            } catch (error) {
                forgotPasswordMessage.className = 'message error';
                forgotPasswordMessage.textContent = 'No se pudo conectar al servidor.';
            }
        });
    }
});
//
const resetPasswordForm = document.getElementById('resetPasswordForm');
const resetPasswordMessage = document.getElementById('resetPasswordMessage');

if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const token = document.getElementById('token').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        try {
            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword, confirmPassword }),
            });

            const data = await response.json();

            if (response.ok) {
                resetPasswordMessage.className = 'message success';
                resetPasswordMessage.textContent = data.message || 'Contraseña restablecida exitosamente. Redirigiendo...';
                setTimeout(() => {
                    window.location.href = 'http://127.0.0.1:5500/Backend/public/Frontend/login.html'; // Reemplaza con la URL de tu página de inicio de sesión
                }, 500); // Redirigir después de un breve mensaje
            } else {
                resetPasswordMessage.className = 'message error';
                resetPasswordMessage.textContent = data.message || 'Error al restablecer la contraseña.';
            }
        } catch (error) {
            resetPasswordMessage.className = 'message error';
            resetPasswordMessage.textContent = 'Error de conexión con el servidor.';
        }
    });
}