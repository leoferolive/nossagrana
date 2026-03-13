import { useState } from "react";

const colors = {
    bg: "#0F1117",
    card: "#1A1D27",
    cardHover: "#22252F",
    border: "#2A2D3A",
    primary: "#22C55E",
    primaryDark: "#16A34A",
    danger: "#EF4444",
    warning: "#F59E0B",
    text: "#E8E8ED",
    textMuted: "#8B8D98",
    textDim: "#5C5E6A",
    accent: "#3B82F6",
};

const BottomNav = ({ active, onNavigate }) => {
    const tabs = [
        { id: "dashboard", icon: "🏠", label: "Home" },
        { id: "extrato", icon: "📋", label: "Extrato" },
        { id: "relatorios", icon: "📊", label: "Relatórios" },
        { id: "config", icon: "⚙️", label: "Config" },
    ];
    return (
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: "8px 0 12px", background: colors.card, borderTop: `1px solid ${colors.border}` }}>
            {tabs.map((t) => (
                <div key={t.id} onClick={() => onNavigate(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", opacity: active === t.id ? 1 : 0.5, color: active === t.id ? colors.primary : colors.textMuted, transition: "all 0.2s" }}>
                    <span style={{ fontSize: 20 }}>{t.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.5px" }}>{t.label}</span>
                </div>
            ))}
        </div>
    );
};

const FAB = ({ onClick }) => (
    <div onClick={onClick} style={{ position: "absolute", bottom: 76, right: 20, width: 52, height: 52, borderRadius: "50%", background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff", cursor: "pointer", boxShadow: "0 4px 20px rgba(34,197,94,0.4)", fontWeight: 300, transition: "transform 0.2s" }}
         onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
         onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>+</div>
);

const Header = ({ title, subtitle, right }) => (
    <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.text, letterSpacing: "-0.3px" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {right}
    </div>
);

const LoginScreen = ({ onLogin, onSignup }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 32, gap: 24 }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: colors.primary, letterSpacing: "-1px" }}>NossaGrana</div>
        <div style={{ fontSize: 13, color: colors.textMuted, marginTop: -16 }}>Finanças da família, simplificadas</div>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <input placeholder="Email" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            <input placeholder="Senha" type="password" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            <div onClick={onLogin} style={{ width: "100%", padding: "13px", borderRadius: 10, background: colors.primary, color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 14, cursor: "pointer", boxSizing: "border-box" }}>Entrar</div>
        </div>
        <div style={{ fontSize: 13, color: colors.textMuted }}>
            Não tem conta? <span onClick={onSignup} style={{ color: colors.primary, cursor: "pointer", fontWeight: 600 }}>Cadastre-se</span>
        </div>
    </div>
);

const SignupScreen = ({ onBack, onNext }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 24, gap: 16 }}>
        <div onClick={onBack} style={{ fontSize: 13, color: colors.primary, cursor: "pointer" }}>← Voltar</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>Criar Conta</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            <input placeholder="Nome" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            <input placeholder="Email" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            <input placeholder="Senha" type="password" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            <div onClick={onNext} style={{ width: "100%", padding: "13px", borderRadius: 10, background: colors.primary, color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 8, boxSizing: "border-box" }}>Continuar</div>
        </div>
    </div>
);

const FamilySetupScreen = ({ onComplete }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 24, gap: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>Entrar numa Família</div>
        <div style={{ fontSize: 13, color: colors.textMuted }}>Crie uma nova família ou entre com um código de convite.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div onClick={onComplete} style={{ padding: 16, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, cursor: "pointer" }}>
                <div style={{ fontWeight: 700, color: colors.text, fontSize: 14 }}>🏠 Criar Família</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Comece uma nova família e convide membros</div>
            </div>
            <div onClick={onComplete} style={{ padding: 16, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, cursor: "pointer" }}>
                <div style={{ fontWeight: 700, color: colors.text, fontSize: 14 }}>🔗 Tenho um código de convite</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Cole o código ou link que recebeu</div>
            </div>
            <div onClick={onComplete} style={{ padding: 16, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, cursor: "pointer" }}>
                <div style={{ fontWeight: 700, color: colors.text, fontSize: 14 }}>🔍 Buscar Família</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Encontre e solicite entrada numa família</div>
            </div>
        </div>
    </div>
);

const SummaryCard = ({ label, value, color }) => (
    <div style={{ flex: 1, padding: "14px 12px", borderRadius: 12, background: colors.card, border: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4, letterSpacing: "-0.5px" }}>{value}</div>
    </div>
);

const BudgetBar = ({ category, spent, limit }) => {
    const pct = Math.min((spent / limit) * 100, 120);
    const barColor = pct >= 100 ? colors.danger : pct >= 80 ? colors.warning : colors.primary;
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: colors.text, fontWeight: 600 }}>{category}</span>
                <span style={{ color: colors.textMuted }}>R${spent} / R${limit}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: colors.border }}>
                <div style={{ height: "100%", borderRadius: 3, background: barColor, width: `${Math.min(pct, 100)}%`, transition: "width 0.5s" }} />
            </div>
        </div>
    );
};

const MiniChart = ({ data, height = 60, color = colors.primary }) => {
    const max = Math.max(...data);
    const w = 100 / (data.length - 1);
    const points = data.map((v, i) => `${i * w},${height - (v / max) * (height - 10)}`).join(" ");
    return (
        <svg viewBox={`0 0 100 ${height}`} style={{ width: "100%", height }}>
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((v, i) => (
                <circle key={i} cx={i * w} cy={height - (v / max) * (height - 10)} r="2" fill={color} />
            ))}
        </svg>
    );
};

const PieChart = ({ data }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    let acc = 0;
    const chartColors = ["#22C55E", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg viewBox="0 0 100 100" style={{ width: 100, height: 100 }}>
                {data.map((d, i) => {
                    const pct = d.value / total;
                    const start = acc;
                    acc += pct;
                    const x1 = 50 + 40 * Math.cos(2 * Math.PI * start - Math.PI / 2);
                    const y1 = 50 + 40 * Math.sin(2 * Math.PI * start - Math.PI / 2);
                    const x2 = 50 + 40 * Math.cos(2 * Math.PI * acc - Math.PI / 2);
                    const y2 = 50 + 40 * Math.sin(2 * Math.PI * acc - Math.PI / 2);
                    const large = pct > 0.5 ? 1 : 0;
                    return <path key={i} d={`M50,50 L${x1},${y1} A40,40 0 ${large},1 ${x2},${y2} Z`} fill={chartColors[i % chartColors.length]} />;
                })}
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {data.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: chartColors[i % chartColors.length] }} />
                        <span style={{ color: colors.textMuted }}>{d.label}</span>
                        <span style={{ color: colors.text, fontWeight: 600, marginLeft: "auto" }}>{Math.round((d.value / total) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DashboardScreen = () => (
    <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
        <Header title="Março 2026" subtitle="Família Silva" right={<div style={{ fontSize: 11, color: colors.textMuted, background: colors.card, padding: "4px 10px", borderRadius: 20, border: `1px solid ${colors.border}` }}>👤 Leo</div>} />
        <div style={{ display: "flex", gap: 8, margin: "8px 0 16px" }}>
            <SummaryCard label="Receitas" value="R$9.200" color={colors.primary} />
            <SummaryCard label="Despesas" value="R$6.350" color={colors.danger} />
            <SummaryCard label="Saldo" value="R$2.850" color={colors.accent} />
        </div>
        <div style={{ background: colors.card, borderRadius: 12, padding: 16, border: `1px solid ${colors.border}`, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 12 }}>Despesas por Categoria</div>
            <PieChart data={[{ label: "Alimentação", value: 30 }, { label: "Moradia", value: 25 }, { label: "Transporte", value: 15 }, { label: "Lazer", value: 10 }, { label: "Outros", value: 20 }]} />
        </div>
        <div style={{ background: colors.card, borderRadius: 12, padding: 16, border: `1px solid ${colors.border}`, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 12 }}>Evolução no Mês</div>
            <MiniChart data={[800, 1200, 2100, 2800, 3500, 4200, 4900, 5600, 6350]} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: colors.textDim, marginTop: 4 }}>
                <span>01/03</span><span>05/03</span><span>10/03</span>
            </div>
        </div>
        <div style={{ background: colors.card, borderRadius: 12, padding: 16, border: `1px solid ${colors.border}`, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 12 }}>Orçamento</div>
            <BudgetBar category="Alimentação" spent={980} limit={1200} />
            <BudgetBar category="Lazer" spent={450} limit={500} />
            <BudgetBar category="Transporte" spent={410} limit={400} />
        </div>
        <div style={{ background: colors.card, borderRadius: 12, padding: 14, border: `1px solid ${colors.border}`, display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 80 }}>
            <span style={{ fontSize: 18 }}>💡</span>
            <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.5 }}>Transporte ultrapassou o orçamento em <span style={{ color: colors.danger, fontWeight: 700 }}>R$10</span>. Lazer está em <span style={{ color: colors.warning, fontWeight: 700 }}>90%</span> do limite.</div>
        </div>
    </div>
);

const transactions = [
    { date: "11/03", desc: "Supermercado Extra", cat: "Alimentação", val: -180, user: "Maria", method: "Nubank", badge: null },
    { date: "10/03", desc: "Uber", cat: "Transporte", val: -32, user: "Leo", method: "Itaú", badge: null },
    { date: "09/03", desc: "Salário", cat: "Salário", val: 5000, user: "Leo", method: "PIX", badge: null },
    { date: "09/03", desc: "Salário", cat: "Salário", val: 4200, user: "Maria", method: "PIX", badge: null },
    { date: "08/03", desc: "Netflix", cat: "Assinaturas", val: -39, user: "Leo", method: "Itaú", badge: "Recorrente" },
    { date: "07/03", desc: "Geladeira Brastemp", cat: "Compras", val: -250, user: "Maria", method: "Nubank", badge: "3/12" },
    { date: "06/03", desc: "Farmácia", cat: "Saúde", val: -67, user: "Leo", method: "PIX", badge: null },
    { date: "05/03", desc: "Restaurante Outback", cat: "Lazer", val: -189, user: "Maria", method: "Nubank", badge: null },
];

const ExtratoScreen = () => {
    const [filter, setFilter] = useState("todos");
    return (
        <div style={{ flex: 1, overflow: "auto", padding: "0 16px 80px" }}>
            <Header title="Extrato" subtitle="Março 2026" />
            <div style={{ display: "flex", gap: 6, margin: "8px 0 14px", flexWrap: "wrap" }}>
                {["todos", "receitas", "despesas"].map((f) => (
                    <div key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: filter === f ? colors.primary : colors.card, color: filter === f ? "#fff" : colors.textMuted, border: `1px solid ${filter === f ? colors.primary : colors.border}`, textTransform: "capitalize" }}>{f}</div>
                ))}
            </div>
            {transactions
                .filter((t) => filter === "todos" || (filter === "receitas" && t.val > 0) || (filter === "despesas" && t.val < 0))
                .map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${colors.border}`, gap: 12, cursor: "pointer" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: t.val > 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                            {t.val > 0 ? "↑" : "↓"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.desc}</span>
                                {t.badge && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(59,130,246,0.15)", color: colors.accent }}>{t.badge}</span>}
                            </div>
                            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{t.date} · {t.cat} · {t.user} · {t.method}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.val > 0 ? colors.primary : colors.danger, flexShrink: 0 }}>
                            {t.val > 0 ? "+" : ""}R${Math.abs(t.val)}
                        </div>
                    </div>
                ))}
        </div>
    );
};

const RelatoriosScreen = () => (
    <div style={{ flex: 1, overflow: "auto", padding: "0 16px 80px" }}>
        <Header title="Relatórios" subtitle="Março 2026" />
        <div style={{ background: colors.card, borderRadius: 12, padding: 16, border: `1px solid ${colors.border}`, marginTop: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 12 }}>Distribuição de Gastos</div>
            <PieChart data={[{ label: "Alimentação", value: 1900 }, { label: "Moradia", value: 1588 }, { label: "Transporte", value: 953 }, { label: "Lazer", value: 635 }, { label: "Outros", value: 1274 }]} />
        </div>
        <div style={{ background: colors.card, borderRadius: 12, padding: 16, border: `1px solid ${colors.border}`, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 12 }}>Gastos por Membro</div>
            <div style={{ display: "flex", gap: 10 }}>
                {[{ name: "Leo", val: 3200 }, { name: "Maria", val: 3150 }].map((u) => (
                    <div key={u.name} style={{ flex: 1, padding: 12, borderRadius: 10, background: colors.bg, textAlign: "center" }}>
                        <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: colors.text, marginTop: 4 }}>R${u.val.toLocaleString()}</div>
                    </div>
                ))}
            </div>
        </div>
        <div style={{ background: colors.card, borderRadius: 12, padding: 16, border: `1px solid ${colors.border}`, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 12 }}>Comparação com Fevereiro</div>
            <MiniChart data={[5800, 6100, 5400, 6350]} height={50} color={colors.accent} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: colors.textDim, marginTop: 4 }}>
                <span>Dez</span><span>Jan</span><span>Fev</span><span>Mar</span>
            </div>
        </div>
        <div style={{ background: colors.card, borderRadius: 12, padding: 14, border: `1px solid ${colors.border}`, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 10 }}>Tendências</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: colors.textMuted, display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: colors.danger }}>📈</span> Alimentação subiu 12% vs mês anterior</div>
                <div style={{ fontSize: 12, color: colors.textMuted, display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: colors.primary }}>📉</span> Transporte caiu 8% vs mês anterior</div>
                <div style={{ fontSize: 12, color: colors.textMuted, display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: colors.warning }}>⚠️</span> Lazer gastou 25% mais que fevereiro</div>
            </div>
        </div>
    </div>
);

const ConfigScreen = ({ onNavigate }) => {
    const items = [
        { icon: "🏷️", label: "Categorias", id: "categorias" },
        { icon: "💳", label: "Cartões / Pagamentos", id: "cartoes" },
        { icon: "🎯", label: "Orçamento Mensal", id: "orcamento" },
        { icon: "👨‍👩‍👧‍👦", label: "Família", id: "familia" },
        { icon: "📅", label: "Histórico de Meses", id: "historico" },
        { icon: "👤", label: "Perfil / Conta", id: "perfil" },
    ];
    return (
        <div style={{ flex: 1, overflow: "auto", padding: "0 16px 80px" }}>
            <Header title="Configurações" />
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
                {items.map((item) => (
                    <div key={item.id} onClick={() => onNavigate(item.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 12px", borderRadius: 10, cursor: "pointer", transition: "background 0.15s" }}
                         onMouseEnter={(e) => (e.currentTarget.style.background = colors.cardHover)}
                         onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <span style={{ fontSize: 20 }}>{item.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{item.label}</span>
                        <span style={{ marginLeft: "auto", color: colors.textDim, fontSize: 14 }}>›</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CategoriasScreen = ({ onBack }) => (
    <div style={{ flex: 1, overflow: "auto", padding: "0 16px 80px" }}>
        <div onClick={onBack} style={{ padding: "14px 4px 0", fontSize: 13, color: colors.primary, cursor: "pointer" }}>← Voltar</div>
        <Header title="Categorias" />
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, padding: "12px 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Despesas</div>
        {["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Assinaturas", "Compras"].map((c) => (
            <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${colors.border}` }}>
                <span style={{ fontSize: 13, color: colors.text }}>{c}</span>
                <span style={{ fontSize: 11, color: colors.textMuted, cursor: "pointer" }}>editar</span>
            </div>
        ))}
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, padding: "16px 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Receitas</div>
        {["Salário", "Bônus", "Investimentos"].map((c) => (
            <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${colors.border}` }}>
                <span style={{ fontSize: 13, color: colors.text }}>{c}</span>
                <span style={{ fontSize: 11, color: colors.textMuted, cursor: "pointer" }}>editar</span>
            </div>
        ))}
        <div style={{ padding: "16px 0", textAlign: "center", fontSize: 13, color: colors.primary, fontWeight: 600, cursor: "pointer" }}>+ Nova Categoria</div>
    </div>
);

const CartoesScreen = ({ onBack }) => (
    <div style={{ flex: 1, overflow: "auto", padding: "0 16px 80px" }}>
        <div onClick={onBack} style={{ padding: "14px 4px 0", fontSize: 13, color: colors.primary, cursor: "pointer" }}>← Voltar</div>
        <Header title="Cartões e Pagamentos" />
        {[
            { name: "Nubank Crédito", tipo: "crédito", fecha: "03", vence: "10", user: "Leo" },
            { name: "Itaú Crédito", tipo: "crédito", fecha: "15", vence: "22", user: "Maria" },
            { name: "PIX", tipo: "pix", user: "Ambos" },
            { name: "Dinheiro", tipo: "dinheiro", user: "Ambos" },
        ].map((c, i) => (
            <div key={i} style={{ background: colors.card, borderRadius: 12, padding: 14, border: `1px solid ${colors.border}`, marginTop: 10, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                            {c.tipo === "crédito" ? `Fecha dia ${c.fecha} · Vence dia ${c.vence}` : c.tipo.toUpperCase()} · {c.user}
                        </div>
                    </div>
                    <span style={{ fontSize: 20 }}>{c.tipo === "crédito" ? "💳" : c.tipo === "pix" ? "⚡" : "💵"}</span>
                </div>
            </div>
        ))}
        <div style={{ padding: "16px 0", textAlign: "center", fontSize: 13, color: colors.primary, fontWeight: 600, cursor: "pointer" }}>+ Novo Método</div>
    </div>
);

const OrcamentoScreen = ({ onBack }) => (
    <div style={{ flex: 1, overflow: "auto", padding: "0 16px 80px" }}>
        <div onClick={onBack} style={{ padding: "14px 4px 0", fontSize: 13, color: colors.primary, cursor: "pointer" }}>← Voltar</div>
        <Header title="Orçamento Mensal" subtitle="Vigente desde Mar/2026" />
        {[
            { cat: "Alimentação", limit: 1200, spent: 980 },
            { cat: "Moradia", limit: 2000, spent: 2000 },
            { cat: "Transporte", limit: 400, spent: 410 },
            { cat: "Lazer", limit: 500, spent: 450 },
            { cat: "Saúde", limit: 300, spent: 67 },
            { cat: "Assinaturas", limit: 200, spent: 139 },
        ].map((b, i) => (
            <div key={i} style={{ background: colors.card, borderRadius: 12, padding: 14, border: `1px solid ${colors.border}`, marginTop: 10 }}>
                <BudgetBar category={b.cat} spent={b.spent} limit={b.limit} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 11, color: colors.textMuted, cursor: "pointer" }}>editar limite</span>
                </div>
            </div>
        ))}
    </div>
);

const FamiliaScreen = ({ onBack }) => (
    <div style={{ flex: 1, overflow: "auto", padding: "0 16px 80px" }}>
        <div onClick={onBack} style={{ padding: "14px 4px 0", fontSize: 13, color: colors.primary, cursor: "pointer" }}>← Voltar</div>
        <Header title="Família Silva" />
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, padding: "12px 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Membros</div>
        {[{ name: "Leo", role: "Admin", email: "leo@email.com" }, { name: "Maria", role: "Membro", email: "maria@email.com" }].map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>{m.name[0]}</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: colors.textMuted }}>{m.email}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: m.role === "Admin" ? "rgba(34,197,94,0.15)" : "rgba(139,141,152,0.15)", color: m.role === "Admin" ? colors.primary : colors.textMuted }}>{m.role}</span>
            </div>
        ))}
        <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Convite</div>
            <div style={{ background: colors.card, borderRadius: 10, padding: 14, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <code style={{ fontSize: 13, color: colors.accent }}>FAM-8X2K-9P1M</code>
                <span style={{ fontSize: 11, color: colors.primary, fontWeight: 600, cursor: "pointer" }}>Copiar</span>
            </div>
        </div>
        <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Solicitações Pendentes</div>
            <div style={{ background: colors.card, borderRadius: 10, padding: 14, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>Carlos</div>
                    <div style={{ fontSize: 11, color: colors.textMuted }}>carlos@email.com</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ padding: "5px 12px", borderRadius: 6, background: colors.primary, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Aceitar</span>
                    <span style={{ padding: "5px 12px", borderRadius: 6, background: colors.border, color: colors.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Recusar</span>
                </div>
            </div>
        </div>
    </div>
);

const HistoricoScreen = ({ onBack }) => (
    <div style={{ flex: 1, overflow: "auto", padding: "0 16px 80px" }}>
        <div onClick={onBack} style={{ padding: "14px 4px 0", fontSize: 13, color: colors.primary, cursor: "pointer" }}>← Voltar</div>
        <Header title="Histórico de Meses" />
        <div style={{ background: colors.card, borderRadius: 12, padding: 16, border: `1px solid ${colors.border}`, marginTop: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 12 }}>Evolução Mensal</div>
            <MiniChart data={[1200, 2300, 1800, 2850, 1500, 2850]} height={50} color={colors.accent} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: colors.textDim, marginTop: 4 }}>
                <span>Out</span><span>Nov</span><span>Dez</span><span>Jan</span><span>Fev</span><span>Mar</span>
            </div>
        </div>
        {[
            { mes: "Março 2026", rec: 9200, desp: 6350, saldo: 2850, divergente: false, atual: true },
            { mes: "Fevereiro 2026", rec: 8800, desp: 7300, saldo: 1500, divergente: true, atual: false },
            { mes: "Janeiro 2026", rec: 9000, desp: 6150, saldo: 2850, divergente: false, atual: false },
            { mes: "Dezembro 2025", rec: 11200, desp: 9400, saldo: 1800, divergente: false, atual: false },
            { mes: "Novembro 2025", rec: 8800, desp: 6500, saldo: 2300, divergente: false, atual: false },
        ].map((m, i) => (
            <div key={i} style={{ background: colors.card, borderRadius: 12, padding: 14, border: `1px solid ${colors.border}`, marginBottom: 8, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>{m.mes}</span>
                        {m.atual && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(34,197,94,0.15)", color: colors.primary }}>ATUAL</span>}
                        {m.divergente && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(245,158,11,0.15)", color: colors.warning }}>⚠ DIVERGENTE</span>}
                    </div>
                    <span style={{ color: colors.textDim, fontSize: 14 }}>›</span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                    <span style={{ color: colors.primary }}>↑ R${m.rec.toLocaleString()}</span>
                    <span style={{ color: colors.danger }}>↓ R${m.desp.toLocaleString()}</span>
                    <span style={{ color: colors.accent, fontWeight: 700 }}>= R${m.saldo.toLocaleString()}</span>
                </div>
            </div>
        ))}
    </div>
);

const TransactionModal = ({ onClose }) => {
    const [tipo, setTipo] = useState("despesa");
    const [parcelado, setParcelado] = useState(false);
    const [recorrente, setRecorrente] = useState(false);
    return (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", justifyContent: "flex-end", zIndex: 10 }} onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: colors.bg, borderRadius: "20px 20px 0 0", padding: 24, maxHeight: "88%", overflow: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>Nova Transação</span>
                    <span onClick={onClose} style={{ fontSize: 20, color: colors.textMuted, cursor: "pointer" }}>✕</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    {["despesa", "receita"].map((t) => (
                        <div key={t} onClick={() => setTipo(t)} style={{ flex: 1, padding: "10px", borderRadius: 10, textAlign: "center", fontSize: 13, fontWeight: 700, cursor: "pointer", background: tipo === t ? (t === "despesa" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)") : colors.card, color: tipo === t ? (t === "despesa" ? colors.danger : colors.primary) : colors.textMuted, border: `1px solid ${tipo === t ? (t === "despesa" ? colors.danger : colors.primary) : colors.border}`, textTransform: "capitalize" }}>{t}</div>
                    ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: 600 }}>VALOR</div>
                        <input placeholder="R$ 0,00" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 22, fontWeight: 800, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: 600 }}>CATEGORIA</div>
                        <select style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box", appearance: "none" }}>
                            <option>Alimentação</option><option>Moradia</option><option>Transporte</option><option>Lazer</option><option>Saúde</option><option>Assinaturas</option><option>Compras</option>
                        </select>
                    </div>
                    <div>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: 600 }}>DESCRIÇÃO</div>
                        <input placeholder="Ex: Supermercado semanal" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: 600 }}>DATA</div>
                            <input type="date" defaultValue="2026-03-11" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: 600 }}>PAGAMENTO</div>
                            <select style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box", appearance: "none" }}>
                                <option>Nubank</option><option>Itaú</option><option>PIX</option><option>Dinheiro</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <div onClick={() => { setParcelado(!parcelado); if (!parcelado) setRecorrente(false); }} style={{ flex: 1, padding: "10px", borderRadius: 10, textAlign: "center", fontSize: 12, fontWeight: 600, cursor: "pointer", background: parcelado ? "rgba(59,130,246,0.15)" : colors.card, color: parcelado ? colors.accent : colors.textMuted, border: `1px solid ${parcelado ? colors.accent : colors.border}` }}>
                            Parcelado
                        </div>
                        <div onClick={() => { setRecorrente(!recorrente); if (!recorrente) setParcelado(false); }} style={{ flex: 1, padding: "10px", borderRadius: 10, textAlign: "center", fontSize: 12, fontWeight: 600, cursor: "pointer", background: recorrente ? "rgba(59,130,246,0.15)" : colors.card, color: recorrente ? colors.accent : colors.textMuted, border: `1px solid ${recorrente ? colors.accent : colors.border}` }}>
                            Recorrente
                        </div>
                    </div>
                    {parcelado && (
                        <div>
                            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: 600 }}>NÚMERO DE PARCELAS</div>
                            <input placeholder="12" type="number" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                        </div>
                    )}
                    {recorrente && (
                        <div style={{ display: "flex", gap: 10 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: 600 }}>FREQUÊNCIA</div>
                                <select style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box", appearance: "none" }}>
                                    <option>Mensal</option><option>Semanal</option><option>Quinzenal</option>
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: 600 }}>ATÉ (OPCIONAL)</div>
                                <input type="date" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                            </div>
                        </div>
                    )}
                    <div onClick={onClose} style={{ width: "100%", padding: "14px", borderRadius: 12, background: colors.primary, color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 8, boxSizing: "border-box" }}>
                        Salvar Transação
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function NossaGranaWireframe() {
    const [screen, setScreen] = useState("login");
    const [subScreen, setSubScreen] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const mainScreens = ["dashboard", "extrato", "relatorios", "config"];
    const isMain = mainScreens.includes(screen);

    const renderScreen = () => {
        if (subScreen === "categorias") return <CategoriasScreen onBack={() => setSubScreen(null)} />;
        if (subScreen === "cartoes") return <CartoesScreen onBack={() => setSubScreen(null)} />;
        if (subScreen === "orcamento") return <OrcamentoScreen onBack={() => setSubScreen(null)} />;
        if (subScreen === "familia") return <FamiliaScreen onBack={() => setSubScreen(null)} />;
        if (subScreen === "historico") return <HistoricoScreen onBack={() => setSubScreen(null)} />;

        switch (screen) {
            case "login": return <LoginScreen onLogin={() => setScreen("dashboard")} onSignup={() => setScreen("signup")} />;
            case "signup": return <SignupScreen onBack={() => setScreen("login")} onNext={() => setScreen("family-setup")} />;
            case "family-setup": return <FamilySetupScreen onComplete={() => setScreen("dashboard")} />;
            case "dashboard": return <DashboardScreen />;
            case "extrato": return <ExtratoScreen />;
            case "relatorios": return <RelatoriosScreen />;
            case "config": return <ConfigScreen onNavigate={(id) => setSubScreen(id)} />;
            default: return <DashboardScreen />;
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#080810", minHeight: "100vh", padding: "20px 0", fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
            <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 12, fontWeight: 600, letterSpacing: "0.5px" }}>
                NOSSAGRANA — WIREFRAME INTERATIVO
            </div>
            <div style={{ width: 375, height: 720, background: colors.bg, borderRadius: 24, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column", border: `1px solid ${colors.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                {renderScreen()}
                {isMain && !subScreen && <FAB onClick={() => setShowModal(true)} />}
                {isMain && !subScreen && <BottomNav active={screen} onNavigate={(id) => { setScreen(id); setSubScreen(null); }} />}
                {showModal && <TransactionModal onClose={() => setShowModal(false)} />}
            </div>
            {isMain && (
                <div style={{ marginTop: 14, fontSize: 11, color: colors.textDim, textAlign: "center", maxWidth: 375 }}>
                    Navegue pelas tabs abaixo · Clique no <span style={{ color: colors.primary, fontWeight: 700 }}>+</span> para nova transação · Acesse as sub-telas em Config
                </div>
            )}
        </div>
    );
}