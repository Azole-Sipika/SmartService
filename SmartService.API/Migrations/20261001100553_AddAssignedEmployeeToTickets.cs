using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartService.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAssignedEmployeeToTickets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AssignedEmployeeId",
                table: "Tickets",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_AssignedEmployeeId",
                table: "Tickets",
                column: "AssignedEmployeeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tickets_Users_AssignedEmployeeId",
                table: "Tickets",
                column: "AssignedEmployeeId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tickets_Users_AssignedEmployeeId",
                table: "Tickets");

            migrationBuilder.DropIndex(
                name: "IX_Tickets_AssignedEmployeeId",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "AssignedEmployeeId",
                table: "Tickets");
        }
    }
}
