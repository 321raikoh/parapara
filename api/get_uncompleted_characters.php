<?php
header("Content-Type: text/plain; charset=UTF-8");

require_once("CONSTANTS.inc");
require_once("db.inc");
$connection = getConnection();

$x = $_GET["x"];

$list = array();
try {

	$query = "SELECT id,title,author,y FROM characters WHERE x IS NULL";
	$resultset = mysql_query($query, $connection) or throwException(mysql_error());

	$ids = "";
	while ($row = mysql_fetch_array($resultset)) {
		$character = array();
		$id = intval($row["id"]);
		$character["id"] = $id;
		$character["title"] = $row["title"];
		$character["author"] = $row["author"];
		$character["y"] = intval($row["y"]);
		$character["x"] = $x;
		array_push($list, $character);
		if (strlen($ids) != 0) {
			$ids .= ",";
		}
		$ids .= $id;
	}
	mysql_free_result($resultset);
	//update
	if (strlen($ids) != 0) {
		$query4update = "UPDATE characters set x=$x WHERE id IN ($ids)";
		mysql_query($query4update, $connection) or throwException(mysql_error());
	}	
} catch (Exception $e) {
	$list["error"] = $e->getMessage();
}
mysql_close($connection);

echo json_encode($list);
?>