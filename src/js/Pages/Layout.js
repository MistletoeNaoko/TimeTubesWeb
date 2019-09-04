import React from 'react';
import {BrowserRouter as Router, Route, Link} from 'react-router-dom';
import Menu from './Menu';
import Visualization from "./Visualization";
import Header from '../Components/Header';

// Layout menu, visualization, feature form, etc.
// export default class Layout extends React.Component {
//     constructor() {
//         super();
//     }
//
//     render() {
//         return (
//             <Router>
//                 <div>
//                 <Route exact path='/' component={Page1}/>
//                 <Route path='/header' component={Header}/>
//                 </div>
//             {/*<Page1/>*/}
//             </Router>
//         );
//     }
// }
function App() {
    return (
        <Router>
            <div>
                <Menu/>
                <Route exact path="/" component={Visualization} />
                <Route path="/about" component={Header} />
            </div>
        </Router>
    )
}
export default App;
