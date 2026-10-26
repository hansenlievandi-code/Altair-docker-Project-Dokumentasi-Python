import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar.jsx";
import { Sidebar } from "./Sidebar.jsx";
import Footer from "./Footer.jsx";

const MainLayout = ({ theme, toggleTheme }) => {
    return (
        <>
            <Navbar theme={theme} toggleTheme={toggleTheme} />

            <div className="container-fluid ">
                <div className="row g-0 align-items-stretch">
                    <div className="col-lg-3 col-xl-2 sidebar">
                        <Sidebar />
                    </div>
                    <div className="col-lg-9 col-xl-10 d-flex flex-column">
                        <div className="content-container flex-grow-1">
                            <Outlet context={{ theme }} />
                        </div>
                    </div>
                    <Footer />
                </div>
            </div>
        </>
    );
};

export default MainLayout;
