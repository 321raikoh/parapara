<?php
require_once("CONSTANTS.inc");
require_once("db.inc");

header("Content-Type: text/plain; charset=UTF-8");

// Check if event if over
if (!ACCEPT_CHARACTERS) {
  print "{\"error_key\":\"not_live\"}\n\n";
  exit;
}

// Read JSON request
$handle = fopen('php://input','r');
$jsonString = fgets($handle);
$json = json_decode($jsonString,true);
fclose($handle);

// Parse request
$title = $json["title"];
$author = $json["author"];
$y = $json["y"];
$svg = $json["svg"];
$id = $json["id"];

$connection = getConnection();

try {
  $rtime = ceil(microtime(TRUE)*1000);

  // Add or update the entry in the characters table
  if ($id) {
    $query4update =
      "UPDATE characters SET title='$title',author='$author',y=$y," .
      "rtime=$rtime,x=NULL WHERE id=$id";
    mysql_query($query4update, $connection) or throwException(mysql_error());
  } else {
    $query4insert =
      "INSERT INTO characters(title,author,y,rtime) VALUES('$title'," .
      "'$author',$y,$rtime)";
    mysql_query($query4insert, $connection) or throwException(mysql_error());
  }

  // Get the id
  if (!$id) {
    $id = mysql_insert_id();
  }

  // Save file
  // XXXbb We should use a DB transaction for the above and roll it back if 
  // saving the file fails
  // (First, switch to PDO?)
  $svgfilename = CHARACTERS_DIR . $id . ".svg";
  $svgfile = @fopen($svgfilename, 'w');
  if ($svgfile == false) {
    print '{"error_key":"failed_to_write",'
      . '"error_detail":"このファイルには書き込みできません"}' . "\n\n";
  } else {
    fwrite($svgfile, $svg);
    fclose($svgfile);
    $url = rel2abs($svgfilename, curUrl());
    // XXX Shorten URL
    print "{\"id\":$id,\"url\":\"$url\"}\n\n";
  }
} catch (Exception $e) {
  $message = $e->getMessage();
  print "{\"error_key\":\"db_error\",\"error_detail\":\"$message\"}\n\n";
}
mysql_close($connection);

// Source:
//  http://nashruddin.com/PHP_Script_for_Converting_Relative_to_Absolute_URL
//
// If this proves inadequate, see: http://publicmind.in/blog/urltoabsolute/ for 
// a more thoroughgoing implementation (BSD license).
function rel2abs($rel, $base)
{
  /* return if already absolute URL */
  if (parse_url($rel, PHP_URL_SCHEME) != '') return $rel;

  /* queries and anchors */
  if ($rel[0]=='#' || $rel[0]=='?') return $base.$rel;

  /* parse base URL and convert to local variables:
     $scheme, $host, $path */
  extract(parse_url($base));

  /* remove non-directory element from path */
  $path = preg_replace('#/[^/]*$#', '', $path);

  /* destroy path if relative url points to root */
  if ($rel[0] == '/') $path = '';

  /* dirty absolute URL */
  $abs = "$host$path/$rel";

  /* replace '//' or '/./' or '/foo/../' with '/' */
  $re = array('#(/\.?/)#', '#/(?!\.\.)[^/]+/\.\./#');
  for($n=1; $n>0; $abs=preg_replace($re, '/', $abs, -1, $n)) {}

  /* absolute URL is ready! */
  return $scheme.'://'.$abs;
}

// Based on: http://webcheatsheet.com/php/get_current_page_url.php
function curUrl() {
  $ssl  = isset($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] == "on";
  $port = isset($_SERVER["SERVER_PORT"]) &&
          ((!$ssl && $_SERVER["SERVER_PORT"] != "80") ||
           ($ssl  && $_SERVER["SERVER_PORT"] != "443"));
  $port = $port ? ':' . $_SERVER["SERVER_PORT"] : '';
  $url = ($ssl ? 'https://' : 'http://') . $_SERVER["SERVER_NAME"] . $port .
         $_SERVER["SCRIPT_NAME"];
  return $url;
}
?>
