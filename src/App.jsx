import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import Layout from "./componentes/Layout.jsx";
import Login from "./paginas/Login.jsx";
import Inicio from "./paginas/Inicio.jsx";
import Usuarios from "./paginas/Usuarios.jsx";
import EmDia from "./paginas/EmDia.jsx";
import IbsCbs from "./paginas/IbsCbs.jsx";
import NotaSync from "./paginas/NotaSync.jsx";
import Danfse from "./paginas/Danfse.jsx";
import XmlExcel from "./paginas/XmlExcel.jsx";
import SitePublico from "./paginas/SitePublico.jsx";
import AdminMakerPixel from "./paginas/AdminMakerPixel.jsx";
import { AvisosProvider } from "./componentes/Avisos.jsx";
import AvisoAtualizacao from "./componentes/AvisoAtualizacao.jsx";
import ModuloNaoContratado from "./componentes/ModuloNaoContratado.jsx";
import { podeUsarModulo, escritorioAtivo } from "./lib/multiEscritorio.mjs";

function Protegida({ children }) {
  const { carregando, usuario } = useAuth();
  const local = useLocation();
  if (carregando) return <p className="p-8 text-muted" role="status">Carregando seus dados…</p>;
  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  return children;
}

function SoAdmin({ children }) {
  const { usuario } = useAuth();
  return usuario && (usuario.perfil === "admin" || usuario.perfil === "ADMIN_PRODUTO") ? children : <Navigate to="/" replace />;
}

function SoModulo({ modulo, children }) {
  const esc = escritorioAtivo();
  if (!podeUsarModulo(esc, modulo)) {
    return <ModuloNaoContratado modulo={modulo} />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <AvisosProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/planos" element={<SitePublico />} />
            <Route path="/apresentacao" element={<SitePublico />} />
            <Route path="/site" element={<SitePublico />} />
            <Route element={<Protegida><Layout /></Protegida>}>
              <Route index element={<Inicio />} />
              <Route path="notasync" element={<SoModulo modulo="notasync"><NotaSync /></SoModulo>} />
              <Route path="ibs-cbs" element={<SoModulo modulo="reforma"><IbsCbs /></SoModulo>} />
              <Route path="danfse" element={<SoModulo modulo="danfse"><Danfse /></SoModulo>} />
              <Route path="xml-excel" element={<SoModulo modulo="xml-excel"><XmlExcel /></SoModulo>} />
              <Route path="em-dia" element={<SoModulo modulo="em-dia"><EmDia /></SoModulo>} />
              <Route path="usuarios" element={<SoAdmin><Usuarios /></SoAdmin>} />
              <Route path="admin-makerpixel" element={<AdminMakerPixel />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
        <AvisoAtualizacao />
      </AvisosProvider>
    </AuthProvider>
  );
}
