mysqldump: [Warning] Using a password on the command line interface can be insecure.
-- MySQL dump 10.13  Distrib 8.0.43, for Linux (x86_64)
--
-- Host: gateway03.us-east-1.prod.aws.tidbcloud.com    Database: Mua4eQ38uVnrovHUJBRepi
-- ------------------------------------------------------
-- Server version	8.0.11-TiDB-v7.5.2-serverless

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `__drizzle_migrations`
--

DROP TABLE IF EXISTS `__drizzle_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__drizzle_migrations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hash` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=355641;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `__drizzle_migrations`
--

LOCK TABLES `__drizzle_migrations` WRITE;
/*!40000 ALTER TABLE `__drizzle_migrations` DISABLE KEYS */;
INSERT INTO `__drizzle_migrations` VALUES (1,'814a08e40d7fc2bcfd458759d18319198ca8ae394f2fa15617a78678e9c9c93b',1770863106219),(2,'c205e582afb826e22c34726e30bdeb8eeb5188fd9af5ad3b4370812ba0e534c2',1770863257548),(3,'b76d0c0c687c319502f2ea01c018d126e19bd57c37abaa33012345be9785b5c1',1770864266925),(4,'6cc997488660d4991b363bac166027a9f79a6f4a2026f56427809ca2a5a98cb5',1770865120914),(5,'616e10f1ea44147e138413d417db3bcc5abc59b3da3a04c33120dccbbb1f7b54',1770866463236),(205641,'6104fcaf1a50d12e5defbb33af1e9a64aae0162ef77fe7b2bd884f4397cb970a',1770967461489),(235641,'e2b1c8185caedab860ba4c1d8e1eb190198e3d996e1971edc521b6791a3c51a0',1770983058424),(235642,'0f2da6f8d8acfb19f8c65934c3b66ec1e855611269081d5a20edc9f052753a4f',1770983203894),(265641,'6f922dc4686c08c854144b51106a3684d63c8fa40a3231d50688524bc5094801',1771030886469),(295641,'05f196def1b5540f9e34b508335ff4f13b85d2744c52be1b5db6d3bdb316fc9a',1771033202295),(295642,'efc67e76ecfb42024e3432c610b6aa3402561a9eeb3d742faca7844a03193ff5',1771034323215),(325641,'3c802d1db47152f4013a27b41efa1eb37f0b1899e6529d89182705a03b984dd3',1771041401527);
mysqldump: Couldn't execute 'ROLLBACK TO SAVEPOINT sp': SAVEPOINT sp does not exist (1305)
/*!40000 ALTER TABLE `__drizzle_migrations` ENABLE KEYS */;
UNLOCK TABLES;
