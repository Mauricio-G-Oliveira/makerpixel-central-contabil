import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import Layout from "./componentes/Layout.jsx";
import Login from "./paginas/Login.jsx";
import Inicio from "./paginas/Inicio.jsx";
import ModuloAntigo from "./paginas/ModuloAntigo.jsx";
import Usuarios from "./paginas/Usuarios.jsx";
import Integracao from "./paginas/Integracao.jsx";
import Conta from "./paginas/Conta.jsx";
import Cadastro from "./paginas/Cadastro.jsx";
import Conciliacao from "./paginas/Conciliacao.jsx";
import DepCadastro, { Faturamentos, Demonstrativos } from "./paginas/DepCadastro.jsx";
import Empresas from "./componentes/depCadastro/Empresas.jsx";
import EmDia from "./paginas/EmDia.jsx";
import Lucros from "./paginas/Lucros.jsx";
import Fechamento from "./paginas/Fechamento.jsx";
import Encerramento from "./paginas/Encerramento.jsx";
import Iss from "./paginas/Iss.jsx";
import Icms from "./paginas/Icms.jsx";
import Horas from "./paginas/Horas.jsx";
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
  return usuario && usuario.perfil === "admin" ? children : <Navigate to="/" replace />;
}

/** Só quem tem a área (ex.: integracao) entra; os outros voltam ao Início. */
function SoArea({ area, children }) {
  const { pode } = useAuth();
  return pode(area) ? children : <Navigate to="/" replace />;
}

/** Só entra se o escritório tiver o módulo contratado e ativo. Senão exibe tela de contratação. */
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
      {/* HashRouter: funciona no GitHub Pages sem configuração de servidor (endereços com #/) */}
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/planos" element={<SitePublico />} />
          <Route path="/apresentacao" element={<SitePublico />} />
          <Route path="/site" element={<SitePublico />} />
          <Route element={<Protegida><Layout /></Protegida>}>
            <Route index element={<Inicio />} />
            <Route path="modulo/:id" element={<ModuloAntigo />} />
            <Route path="integracao" element={<SoModulo modulo="integracao"><SoArea area="integracao"><Integracao /></SoArea></SoModulo>} />
            <Route path="conciliacao" element={<SoModulo modulo="conciliacao"><SoArea area="conciliacao"><Conciliacao /></SoArea></SoModulo>} />
            <Route path="conta/:id" element={<SoModulo modulo="integracao"><SoArea area="integracao"><Conta /></SoArea></SoModulo>} />
            <Route path="cadastro/:id" element={<SoModulo modulo="integracao"><SoArea area="integracao"><Cadastro /></SoArea></SoModulo>} />
            <Route path="departamento-cadastro/:secao" element={<SoModulo modulo="vencimentos"><SoArea area="mod-vencimentos"><DepCadastro /></SoArea></SoModulo>} />
            <Route path="empresas" element={<SoArea area="mod-vencimentos"><Empresas /></SoArea>} />
            <Route path="buscar" element={<Navigate to="/empresas" replace />} />
            <Route path="contabil/faturamentos" element={<SoModulo modulo="lucros"><SoArea area="contabil-lucros"><Faturamentos /></SoArea></SoModulo>} />
            <Route path="contabil/demonstrativos" element={<SoModulo modulo="lucros"><SoArea area="contabil-lucros"><Demonstrativos /></SoArea></SoModulo>} />
            <Route path="em-dia" element={<SoModulo modulo="em-dia"><SoArea area="mod-em-dia"><EmDia /></SoArea></SoModulo>} />
            <Route path="lucros" element={<SoModulo modulo="lucros"><SoArea area="contabil-lucros"><Lucros secao="distribuicoes" /></SoArea></SoModulo>} />
            <Route path="reinf" element={<SoModulo modulo="lucros"><SoArea area="contabil-lucros"><Lucros secao="reinf" /></SoArea></SoModulo>} />
            <Route path="fechamento" element={<SoModulo modulo="lucros"><SoArea area="contabil-lucros"><Fechamento /></SoArea></SoModulo>} />
            <Route path="encerramento" element={<SoModulo modulo="lucros"><SoArea area="contabil-lucros"><Encerramento /></SoArea></SoModulo>} />
            <Route path="iss" element={<SoModulo modulo="fiscal"><SoArea area="mod-iss"><Iss /></SoArea></SoModulo>} />
            <Route path="icms" element={<SoModulo modulo="fiscal"><SoArea area="mod-icms"><Icms /></SoArea></SoModulo>} />
            <Route path="horas" element={<SoModulo modulo="horas"><SoArea area="mod-horas"><Horas /></SoArea></SoModulo>} />
            <Route path="ibs-cbs" element={<SoModulo modulo="fiscal"><SoArea area="mod-ibs-cbs"><IbsCbs /></SoArea></SoModulo>} />
            <Route path="notasync" element={<SoModulo modulo="notasync"><SoArea area="mod-notasync"><NotaSync /></SoArea></SoModulo>} />
            <Route path="danfse" element={<SoModulo modulo="danfse"><SoArea area="mod-danfse"><Danfse /></SoArea></SoModulo>} />
            <Route path="xml-excel" element={<SoModulo modulo="fiscal"><SoArea area="mod-xml-excel"><XmlExcel /></SoArea></SoModulo>} />
            {/* o antigo Painel de vencimentos virou Certidões e Alvarás */}
            <Route path="modulo/mod-vencimentos" element={<Navigate to="/departamento-cadastro/certidoes" replace />} />
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
