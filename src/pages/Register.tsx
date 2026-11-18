import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import styles from './Login.module.css';

const Register: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { showToast } = useToast();

    // Disable manual access to the register page
    useEffect(() => {
        navigate('/login');
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                showToast('¡Registro exitoso! Por favor revisa tu correo electrónico para confirmar tu cuenta.', 'success');
                navigate('/login');
            }
        } catch (error: any) {
            setError(error.message || 'Ocurrió un error durante el registro');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>Crear Cuenta</h1>
                <p className={styles.subtitle}>Regístrate para comenzar</p>

                {error && <div className={styles.error}>{error}</div>}

                <form onSubmit={handleRegister} className={styles.form}>
                    <Input
                        label="Correo Electrónico"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="tu@ejemplo.com"
                    />

                    <Input
                        label="Contraseña"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                    />

                    <Input
                        label="Confirmar Contraseña"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                    />

                    <Button type="submit" isLoading={loading} style={{ width: '100%' }}>
                        Registrarse
                    </Button>
                </form>

                <p className={styles.footer}>
                    ¿Ya tienes una cuenta?{' '}
                    <Link to="/login" className={styles.link}>
                        Iniciar sesión
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
