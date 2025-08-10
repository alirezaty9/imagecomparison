import { createHashRouter } from 'react-router-dom';
import Layout from './src/components/Layout';
import Home from './src/pages/Home';
import ImageComparison from './src/pages/ImageComparison';
import About from './src/pages/About';

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
      }
    ]
  }
]);

export default router;