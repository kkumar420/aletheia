import { Link } from 'react-router'

function AuthLayout({
    tagline,
    footerText,
    footerLinkText,
    footerLinkTo,
    children,
}) {
    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="auth-logo__mark">
                        <img
                            src="/images/aletheia-logo.png"
                            alt="Aletheia"
                            className="auth-logo__img"
                        />
                    </div>

                    <h1>Aletheia</h1>
                    <p>{tagline}</p>
                </div>

                {children}

                <div className="auth-footer">
                    <p>
                        {footerText}{' '}
                        <Link to={footerLinkTo} className="auth-link">
                            {footerLinkText}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default AuthLayout