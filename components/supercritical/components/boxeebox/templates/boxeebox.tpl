{component name="html.header"}
{dependency type="component" name="page"}
  <div id="sc_container">
   {component name="page.header"}
   <div id="sc_content">
   <div id="sc_navigation">
    <div class="sc_container_inner">
     {component name="supercritical.boxeebox.menu"}
    </div>
   </div>
    <div class="sc_content_main">
     <div class="sc_container_inner sc_utils_clear_after">
      {component name=$maincontent}
      {component name="supercritical.boxeebox.content.flame"}
     </div>
    </div>
    <div class="sc_content_bottom">
     <div class="sc_container_inner sc_utils_clear_after">
      {component name="supercritical.boxeebox.content.bottom"}
     </div>
    </div>
   </div>
  </div>
  {component name="page.footer"}

{component name="html.footer"}
