import { createHashRouter } from 'react-router-dom';
import Layout from './src/components/Layout';
import Home from './src/pages/Home';
import ImageComparison from './src/pages/ImageComparison';
import About from './src/pages/About';
import License from './src/pages/License';

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />
      },
      {
        path: 'compare',
        element: <ImageComparison />
      },
      {
        path: 'about',
        element: <About />
      },
       { // <-- ۲. این بخش جدید را اضافه کنید
        path: 'license',
        element: <License />
      }
    ]
  }
]);

export default router;