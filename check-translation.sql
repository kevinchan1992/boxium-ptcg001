SELECT 
  id, 
  title, 
  SUBSTRING(titleEn, 1, 100) as titleEn_preview,
  SUBSTRING(titleJa, 1, 100) as titleJa_preview,
  LENGTH(contentEn) as contentEnLength, 
  LENGTH(contentJa) as contentJaLength,
  LENGTH(excerptEn) as excerptEnLength,
  LENGTH(excerptJa) as excerptJaLength
FROM posts 
WHERE id = 30004;
