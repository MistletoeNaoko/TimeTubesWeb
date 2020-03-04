import React from 'react';

export default class About extends React.Component{
    constructor() {
        super();
    }

    render() {
        return (
            <div className='container'>
                {this.overview()}
                {this.demoVideo()}
                {this.github()}
                {this.authors()}
            </div>
        );
    }

    overview() {
        return (
            <div className='aboutContainer'>
                <h2>TimeTubesX</h2>
                <p style={{marginLeft: '2rem', marginRight: '2rem'}}>
                    TimeTubes Web is a web-based visualization tool for BLAZAR observation data. 
                    It visualized observation time stamp and 6 variables simultaneously. 
                    It is helpful for the astronomers to analyze time variations of and correlations among intensity, polarization, and color of the light from blazars.
                    It supports visual comparison of multiple datasets, feature extractions, etc.
                </p>
                <p>
                For more detail information about TimeTubes project, please refer our prior papers.
                    <ul>
                        <li>
                            Naoko Sawada, Masanori Nakayama, Makoto Uemura, and Issei Fujishiro. 
                            “TimeTubes: Automatic Extraction of Observable Blazar Features from Long-Term, Multi-Dimensional Datasets,” 
                            in <em>Proceedings of 2018 IEEE Scientific Visualization Conference (SciVis),</em> Berlin, Germany, DOI: 10.1109/SciVis.2018.8823802, October 2018.
                            <a href='https://ieeexplore.ieee.org/document/8823802'>IEEE Xplore</a>
                        </li>
                        <li>
                            Issei Fujishiro, Naoko Sawada, Masanori Nakayama, Hsiang-Yun Wu, Kazuho Watanabe, Shigeo Takahashi, and Makoto Uemura. 
                            “TimeTubes: Visual Exploration of Observed Blazar Datasets,” 
                            <em>Journal of Physics: Conference Series (JPCS),</em> 
                            Vol. 1036, No. 1, Article No. 012011, DOI: 10.1088/1742-6596/1036/1/012011, Kyoto, Japan, 2018. 
                            <a href='http://iopscience.iop.org/article/10.1088/1742-6596/1036/1/012011'>IOPscience</a>
                        </li>
                        <li>
                            Makoto Uemura, Ryosuke Itoh, Ioannis Liodakis, Dmitry Blinov, Masanori Nakayama, Longyin Xu, Naoko Sawada, Hsiang-Yun Wu, Issei Fujishiro. 
                            “Optical polarization variations in the blazar PKS 1749+096,” 
                            <em>Publications of the Astronomical Society of Japan (PASJ),</em> Vol. 69, No. 6, Article No. 96, DOI: 10.1093/pasj/psx111, November 2017. 
                            <a href='https://academic.oup.com/pasj/article/69/6/96/4609697'>Oxford Academic</a>
                        </li>
                        <li>
                            Naoko Sawada, Masanori Nakayama, Hsiang-Yun Wu, Makoto Uemura, and Issei Fujishiro. 
                            “TimeTubes: Visual Fusion and Validation for Ameliorating Uncertainty of Blazar Datasets from Different Observatories,” 
                            Short papers, in <em>Proceedings of the Computer Graphics International Conference (CGI 2017),</em> Article No. 14, Yokohama, Japan, DOI: 10.1145/3095140.3095154, June 2017.
                            <a href='http://dl.acm.org/citation.cfm?id=3095154'>ACM Digital Library</a>
                        </li>
                    
                    </ul>
                </p>
            </div>
        );
    }

    demoVideo() {
        return (
            <div className='aboutContainer'>
                <h2>Demo Videos</h2>
                <iframe 
                    width="560" height="315" 
                    src="https://www.youtube.com/embed/izChQ4uKksQ" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            </div>
        );
    }

    github() {
        return (
            <div className='aboutContainer'>
                <h2>Source code</h2>
                <p>All the source code of TimeTubesX is publicly accessible and open-source.</p>
                <img className='aboutIcons' src='../../img/GitHub-Mark-120px-plus.png' width='20px' height='20px'></img>
                <a href='https://github.com/MistletoeNaoko/TimeTubesWeb'>https://github.com/MistletoeNaoko/TimeTubesWeb</a>
            </div>
        );
    }

    authors() {
        return (
            <div className='aboutContainer'>
                <h2>Authors</h2>
                <div className='authorList'>
                    <h4>Naoko Sawada</h4>
                    <p>Ph.D Student at Keio University, visiting scholar in Visual Computing Group (VCG) at Harvard University (2018-2020)</p>
                    <img className='aboutIcons' src='../../img/website.png' width='20px' height='20px'></img>
                    <a href='https://mistletoenaoko.github.io/'>https://mistletoenaoko.github.io/</a>
                    <img className='aboutIcons' src='../../img/Twitter_Logo_Blue.png' width='20px' height='20px'></img>
                    <a href='https://twitter.com/NaokoVis'>NaokoVis</a>
                    <img className='aboutIcons' src='../../img/mail.png' width='20px' height='20px'></img>
                    <a href='mailto:naoko.sawada@fj.ics.keio.ac.jp'>Email</a>
                </div>
                <div className='authorList'>
                    <h4>Makoto Uemura</h4>
                    <p>Associate Professor in Hiroshima Astrophysical Science Center (HASC) at Hiroshima University</p>
                    <img className='aboutIcons' src='../../img/website.png' width='20px' height='20px'></img>
                    <a href='https://home.hiroshima-u.ac.jp/uemuram/'>https://home.hiroshima-u.ac.jp/uemuram/</a>
                </div>
                <div className='authorList'>
                    <h4>Johanna Beyer</h4>
                    <p>Research Associate in Visual Computing Group (VCG) at Harvard University</p>
                    <img className='aboutIcons' src='../../img/website.png' width='20px' height='20px'></img>
                    <a href='https://johanna-b.github.io/'>https://johanna-b.github.io/</a>
                    <img className='aboutIcons' src='../../img/mail.png' width='20px' height='20px'></img>
                    <a href='mailto:jbeyer@g.harvard.edu'>Email</a>
                </div>
                <div className='authorList'>
                    <h4>Hanspeter Pfister</h4>
                    <p>An Wang Professor of Computer Science at Harvard University</p>
                    <img className='aboutIcons' src='../../img/website.png' width='20px' height='20px'></img>
                    <a href='https://vcg.seas.harvard.edu/'>https://vcg.seas.harvard.edu/</a>
                    <img className='aboutIcons' src='../../img/Twitter_Logo_Blue.png' width='20px' height='20px'></img>
                    <a href='https://twitter.com/hpfister'>hpfister</a>
                    <img className='aboutIcons' src='../../img/mail.png' width='20px' height='20px'></img>
                    <a href='mailto:pfister@seas.harvard.edu'>Email</a>
                </div>
                <div className='authorList'>
                    <h4>Issei Fujishiro</h4>
                    <p>Professor of Information and Computer Science at Keio University, adjunct Professor at School of Computer Science and Engineering at Hangzhou Dianzi University</p>
                    <img className='aboutIcons' src='../../img/website.png' width='20px' height='20px'></img>
                    <a href='http://fj.ics.keio.ac.jp/'>http://fj.ics.keio.ac.jp/</a>
                    <img className='aboutIcons' src='../../img/mail.png' width='20px' height='20px'></img>
                    <a href='mailto:fuji@ics.keio.ac.jp'>Email</a>
                </div>
            </div>
        )
    }
}
