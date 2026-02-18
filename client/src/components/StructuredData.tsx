import { useEffect } from 'react';

interface StructuredDataProps {
  data: Record<string, any>;
}

export default function StructuredData({ data }: StructuredDataProps) {
  useEffect(() => {
    // Generate a unique ID based on the data type
    const dataType = data['@type'] || 'default';
    const scriptId = `structured-data-${dataType}-${Date.now()}`;
    
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    script.id = scriptId;
    
    document.head.appendChild(script);
    
    return () => {
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [data]);

  return null;
}
