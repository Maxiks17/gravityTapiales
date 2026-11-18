import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import styles from './Login.module.css';

const AcceptInvite: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showToast } = useToast();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');

        if (!tokenHash || type !== 'invite') {
            setError('Link de invitación inválido o expirado');
            // TODO: redireccionar al form de contacto de olariz.com (con un anchor directo al form)
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        }
    }, [searchParams, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
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
            const tokenHash = searchParams.get('token_hash');

            if (!tokenHash) {
                throw new Error('Token de invitación no encontrado');
            }

            const { error: verifyError } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: 'invite',
            });

            if (verifyError) throw verifyError;

            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) throw updateError;

            showToast('¡Cuenta creada exitosamente! Redirigiendo...', 'success');

            setTimeout(() => {
                navigate('/settings?welcome=true');
            }, 1500);

        } catch (err: any) {
            setError(err.message || 'Error al aceptar la invitación');
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>Configura tu contraseña</h1>
                <p className={styles.subtitle}>
                    Has sido invitado a crear una cuenta
                </p>

                {error && <div className={styles.error}>{error}</div>}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <Input
                        label="Nueva Contraseña"
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
                        Crear cuenta
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default AcceptInvite;
